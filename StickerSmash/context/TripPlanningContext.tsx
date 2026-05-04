import React, { createContext, useContext, useState } from 'react';

export type TripFlow = 'full' | 'prebuilt';

export interface DestinationSnapshot {
  id: string;
  name: string;
  country: string;
  flag: string;
  imageUrl: string;
}

interface TripPlanningState {
  flow: TripFlow;
  editingTripId: string; // non-empty when editing an existing committed trip
  destinationId: string;
  destinationSnapshot: DestinationSnapshot | null;
  templateId: string;
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
  setEditingTripId: (id: string) => void;
  setDestinationId: (id: string) => void;
  setDestination: (snapshot: DestinationSnapshot) => void;
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
  editingTripId: '',
  destinationId: '',
  destinationSnapshot: null,
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
  setEditingTripId: () => {},
  setDestinationId: () => {},
  setDestination: () => {},
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
  const setEditingTripId = (editingTripId: string) => setState(s => ({ ...s, editingTripId }));
  const setDestinationId = (destinationId: string) => setState(s => ({ ...s, destinationId }));
  const setDestination = (snapshot: DestinationSnapshot) => setState(s => ({ ...s, destinationId: snapshot.id, destinationSnapshot: snapshot }));
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
        setFlow, setEditingTripId, setDestinationId, setDestination, setTemplateId, setTemplateTitle, setTemplateHeroImage,
        setParty, setStartDate, setEndDate, setInterests, setBudget, reset,
      }}
    >
      {children}
    </TripPlanningContext.Provider>
  );
}

export const useTripPlanning = () => useContext(TripPlanningContext);
