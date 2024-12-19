import { createContext, FC, ReactNode, useContext } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";

const EventDetectionContext = createContext<UseLiveAPIResults | undefined>(undefined);

export type EventDetectionProviderProps = {
    children: ReactNode;
    url?: string;
    apiKey: string;
};

export const EventDetectionProvider: FC<EventDetectionProviderProps> = ({
    url,
    apiKey,
    children,
}) => {
    const liveAPI = useLiveAPI({ url, apiKey });

    return (
        <EventDetectionContext.Provider value={liveAPI}>
            {children}
        </EventDetectionContext.Provider>
    );
};

export const useEventDetectionContext = () => {
    const context = useContext(EventDetectionContext);
    if (!context) {
        throw new Error("useEventDetectionContext must be used within an EventDetectionProvider");
    }
    return context;
};