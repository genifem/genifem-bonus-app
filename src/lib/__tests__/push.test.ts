/**
 * Push on this phone (plan D10): what the API accepts, what the OS's answers mean, what a
 * tapped push carries, and registering against a fake phone, a fake Expo and a fake API.
 * Registration never throws and never blocks: a build without an EAS project id, a phone
 * that is not a phone, or an API that can't be reached all end quietly with no token.
 */
import {
  forgetThisPhone,
  isExpoPushToken,
  markOffered,
  permissionOf,
  projectIdOf,
  pushPlatform,
  pushTapOf,
  registerThisPhone,
  wasOffered,
} from "@/lib/push";

const mockStore = new Map<string, string>();
const mockKeychain = { push: null as string | null };
const mockApi = jest.fn();

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
// An ES module, so `import * as Device` sees the flag as each test sets it.
jest.mock("expo-device", () => ({ __esModule: true, isDevice: true }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null, easConfig: null } }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
jest.mock("@/lib/api", () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock("@/lib/session", () => ({
  loadPushToken: async () => mockKeychain.push,
  savePushToken: async (token: string | null) => {
    mockKeychain.push = token;
  },
}));
jest.mock("@/lib/storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value);
    },
  },
}));

const platform = jest.requireMock("react-native").Platform as { OS: string };
const device = jest.requireMock("expo-device") as { isDevice: boolean };
const constants = jest.requireMock("expo-constants").default as {
  expoConfig: { extra?: { eas?: { projectId?: string } } } | null;
  easConfig: { projectId?: string } | null;
};
const notifications = jest.requireMock("expo-notifications") as Record<string, jest.Mock>;

const TOKEN = "ExponentPushToken[abcdefgh12345678]";

beforeEach(() => {
  platform.OS = "ios";
  device.isDevice = true;
  constants.expoConfig = { extra: { eas: { projectId: "11111111-2222-3333-4444-555555555555" } } };
  constants.easConfig = null;
  mockKeychain.push = null;
  mockStore.clear();
  mockApi.mockReset();
  mockApi.mockResolvedValue(undefined);
  notifications.getExpoPushTokenAsync!.mockReset();
  notifications.getExpoPushTokenAsync!.mockResolvedValue({ type: "expo", data: TOKEN });
  notifications.setNotificationChannelAsync!.mockClear();
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("the token the API accepts (PushTokenIn)", () => {
  it("takes Expo tokens in both spellings", () => {
    expect(isExpoPushToken(TOKEN)).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxx-yyyy_zz]")).toBe(true);
  });

  it("refuses anything else: a raw device token, a short one, junk", () => {
    expect(isExpoPushToken("f3a9c2e1d4b5a6978877665544332211")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[short]")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[has space ok]")).toBe(false);
    expect(isExpoPushToken(`ExponentPushToken[${"a".repeat(201)}]`)).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });
});

describe("the phone", () => {
  it("is iOS or Android; the web build gets no pushes", () => {
    expect(pushPlatform("ios")).toBe("ios");
    expect(pushPlatform("android")).toBe("android");
    expect(pushPlatform("web")).toBeNull();
  });

  it("finds the EAS project in the app config, else in the EAS build's", () => {
    expect(projectIdOf({ expoConfig: { extra: { eas: { projectId: "abc" } } } })).toBe("abc");
    expect(projectIdOf({ expoConfig: { extra: {} }, easConfig: { projectId: "def" } })).toBe("def");
    expect(projectIdOf({ expoConfig: { extra: { eas: { projectId: "  " } } } })).toBeNull();
    expect(projectIdOf({ expoConfig: null })).toBeNull();
  });
});

describe("the OS's answer", () => {
  it("counts a yes, and iOS's quiet provisional yes, as granted", () => {
    expect(permissionOf({ granted: true, canAskAgain: true })).toBe("granted");
    expect(permissionOf({ granted: false, canAskAgain: false, provisional: true })).toBe("granted");
  });

  it("is still a question while the OS can ask, and settled once it can't", () => {
    expect(permissionOf({ granted: false, canAskAgain: true })).toBe("undetermined");
    expect(permissionOf({ granted: false, canAskAgain: false })).toBe("denied");
  });
});

describe("a tapped push's data", () => {
  it("is the notification's type and id (D14)", () => {
    expect(pushTapOf({ type: "spin_earned", id: "6650aa" })).toEqual({ type: "spin_earned", id: "6650aa" });
  });

  it("still opens something without them: an unknown type lands on the list", () => {
    expect(pushTapOf({ type: 7, id: "" })).toEqual({ type: "", id: null });
    expect(pushTapOf(null)).toEqual({ type: "", id: null });
    expect(pushTapOf("spin_earned")).toEqual({ type: "", id: null });
  });
});

describe("registering this phone", () => {
  it("hands the token to the API for whoever is signed in, and keeps it for sign-out", async () => {
    await expect(registerThisPhone("Shout-outs")).resolves.toBe(TOKEN);
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "11111111-2222-3333-4444-555555555555",
    });
    expect(mockApi).toHaveBeenCalledWith("/me/push-tokens", { method: "PUT", body: { token: TOKEN, platform: "ios" } });
    expect(mockKeychain.push).toBe(TOKEN);
    // iOS has no channels.
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("sets up Android's channel, named in the language on screen, before the token", async () => {
    platform.OS = "android";
    await registerThisPhone("Reconocimientos y premios");
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ name: "Reconocimientos y premios" }),
    );
    expect(mockApi).toHaveBeenCalledWith("/me/push-tokens", {
      method: "PUT",
      body: { token: TOKEN, platform: "android" },
    });
  });

  it("finds the project id in the EAS build config too", async () => {
    constants.expoConfig = { extra: {} };
    constants.easConfig = { projectId: "from-eas" };
    await registerThisPhone("x");
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "from-eas" });
  });

  it("skips quietly without an EAS project id (Expo Go, a local build), and says so once", async () => {
    constants.expoConfig = { extra: {} };
    await expect(registerThisPhone("x")).resolves.toBeNull();
    await expect(registerThisPhone("x")).resolves.toBeNull();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockApi).not.toHaveBeenCalled();
    const said = (console.info as jest.Mock).mock.calls.filter(([text]) => String(text).includes("projectId"));
    expect(said).toHaveLength(1);
  });

  it("does nothing on the web build or a simulator", async () => {
    platform.OS = "web";
    await expect(registerThisPhone("x")).resolves.toBeNull();
    platform.OS = "ios";
    device.isDevice = false;
    await expect(registerThisPhone("x")).resolves.toBeNull();
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("never sends a token the API would refuse", async () => {
    notifications.getExpoPushTokenAsync!.mockResolvedValue({ type: "expo", data: "not-a-token" });
    await expect(registerThisPhone("x")).resolves.toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fails quietly when Expo or the API can't be reached, keeping nothing", async () => {
    mockApi.mockRejectedValue(new Error("no connection"));
    await expect(registerThisPhone("x")).resolves.toBeNull();
    expect(mockKeychain.push).toBeNull();

    notifications.getExpoPushTokenAsync!.mockRejectedValue(new Error("offline"));
    await expect(registerThisPhone("x")).resolves.toBeNull();
  });
});

describe("unregistering this phone", () => {
  it("takes the kept token back from the API and forgets it", async () => {
    mockKeychain.push = TOKEN;
    await forgetThisPhone();
    expect(mockApi).toHaveBeenCalledWith("/me/push-tokens", { method: "DELETE", body: { token: TOKEN } });
    expect(mockKeychain.push).toBeNull();
  });

  it("has nothing to do without one, and keeps it for next time when the API can't be reached", async () => {
    await forgetThisPhone();
    expect(mockApi).not.toHaveBeenCalled();

    mockKeychain.push = TOKEN;
    mockApi.mockRejectedValue(new Error("no connection"));
    await forgetThisPhone();
    expect(mockKeychain.push).toBe(TOKEN);
  });
});

describe("offering pushes", () => {
  it("happens once per person on this phone", async () => {
    expect(await wasOffered("ana")).toBe(false);
    await markOffered("ana");
    expect(await wasOffered("ana")).toBe(true);
    expect(await wasOffered("ben")).toBe(false);
  });
});
