import { createContext, FC, ReactNode, useContext } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";

const MultimodalStateContext = createContext<UseLiveAPIResults | undefined>(undefined);

export type MultimodalStateProviderProps = {
    children: ReactNode;
    url?: string;
    apiKey: string;
};

export const MultimodalStateProvider: FC<MultimodalStateProviderProps> = ({
    url,
    apiKey,
    children,
}) => {
    const liveAPI = useLiveAPI({ url, apiKey });

    return (
        <MultimodalStateContext.Provider value={liveAPI}>
            {children}
        </MultimodalStateContext.Provider>
    );
};

export const useMultimodalStateContext = () => {
    const context = useContext(MultimodalStateContext);
    if (!context) {
        throw new Error("useMultimodalStateContext must be used within a MultimodalStateProvider");
    }
    return context;
}; 