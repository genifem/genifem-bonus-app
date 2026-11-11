import { createContext, type Dispatch, type ReactNode, use, useMemo, useReducer } from "react";

import { type FlowAction, flowReducer, initialFlow, type SetupFlow } from "@/lib/setupFlow";

interface FlowValue {
  flow: SetupFlow;
  dispatch: Dispatch<FlowAction>;
}

const FlowContext = createContext<FlowValue | null>(null);

/**
 * Holds the setup flow for as long as the setup screens are on the stack. It sits in their
 * layout, so going back between steps (the header, a swipe, Android's back button) keeps it,
 * and leaving the section, or finishing it, drops it with the setup token inside.
 */
export function SetupFlowProvider({ children }: { children: ReactNode }) {
  const [flow, dispatch] = useReducer(flowReducer, undefined, () => initialFlow());
  const value = useMemo(() => ({ flow, dispatch }), [flow]);
  return <FlowContext value={value}>{children}</FlowContext>;
}

export function useSetupFlow(): FlowValue {
  const value = use(FlowContext);
  if (!value) throw new Error("useSetupFlow must be used inside SetupFlowProvider");
  return value;
}
