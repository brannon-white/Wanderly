import React, { createContext, useContext, useState } from 'react';

export type TripFlow = 'full' | 'prebuilt';

interface TripPlanningState {
  flow: TripFlow;
  destinationId: string;
  templateId: string;   // for prebuilt flow: which itinerary template
  templateTitle: string;
  templateHeroImage: string;
  party: string;
  startDate: Date | null;
  endDate: Date | null;
  interests: string[];
  budget: string;
}

interface TripPlanningContextType extends TripPlanningState {
  setFlow: (flow: TripFlow) => void;
  setDestinationId: (id: string) => void;
  setTemplateId: (id: string) => void;
  setTemplateTitle: (title: string) => void;
  setTemplateHeroImage: (url: string) => void;
  setParty: (party: string) => void;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  setInterests: (interests: string[]) => void;
  setBudget: (budget: string) => void;
  reset: () => void;
}

const defaultState: TripPlanningState = {
  flow: 'full',
  destinationId: '',
  templateId: '',
  templateTitle: '',
  templateHeroImage: '',
  party: '',
  startDate: null,
  endDate: null,
  interests: [],
  budget: '',
};

const TripPlanningContext = createContext<TripPlanningContextType>({
  ...defaultState,
  setFlow: () => {},
  setDestinationId: () => {},
  setTemplateId: () => {},
  setTemplateTitle: () => {},
  setTemplateHeroImage: () => {},
  setParty: () => {},
  setStartDate: () => {},
  setEndDate: () => {},
  setInterests: () => {},
  setBudget: () => {},
  reset: () => {},
});

export function TripPlanningProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TripPlanningState>(defaultState);

  const setFlow = (flow: TripFlow) => setState(s => ({ ...s, flow }));
  const setDestinationId = (destinationId: string) => setState(s => ({ ...s, destinationId }));
  const setTemplateId = (templateId: string) => setState(s => ({ ...s, templateId }));
  const setTemplateTitle = (templateTitle: string) => setState(s => ({ ...s, templateTitle }));
  const setTemplateHeroImage = (templateHeroImage: string) => setState(s => ({ ...s, templateHeroImage }));
  const setParty = (party: string) => setState(s => ({ ...s, party }));
  const setStartDate = (startDate: Date | null) => setState(s => ({ ...s, startDate }));
  const setEndDate = (endDate: Date | null) => setState(s => ({ ...s, endDate }));
  const setInterests = (interests: string[]) => setState(s => ({ ...s, interests }));
  const setBudget = (budget: string) => setState(s => ({ ...s, budget }));
  const reset = () => setState(defaultState);

  return (
    <TripPlanningContext.Provider
      value={{
        ...state,
        setFlow, setDestinationId, setTemplateId, setTemplateTitle, setTemplateHeroImage,
        setParty, setStartDate, setEndDate, setInterests, setBudget, reset,
      }}
    >
      {children}
    </TripPlanningContext.Provider>
  );
}

export const useTripPlanning = () => useContext(TripPlanningContext);
