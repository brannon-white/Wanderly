import React, { createContext, useContext, useState } from 'react';

interface TripPlanningState {
  destinationId: string;
  party: string;
  startDate: Date | null;
  endDate: Date | null;
  interests: string[];
  budget: string;
}

interface TripPlanningContextType extends TripPlanningState {
  setDestinationId: (id: string) => void;
  setParty: (party: string) => void;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  setInterests: (interests: string[]) => void;
  setBudget: (budget: string) => void;
  reset: () => void;
}

const defaultState: TripPlanningState = {
  destinationId: '',
  party: '',
  startDate: null,
  endDate: null,
  interests: [],
  budget: '',
};

const TripPlanningContext = createContext<TripPlanningContextType>({
  ...defaultState,
  setDestinationId: () => {},
  setParty: () => {},
  setStartDate: () => {},
  setEndDate: () => {},
  setInterests: () => {},
  setBudget: () => {},
  reset: () => {},
});

export function TripPlanningProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TripPlanningState>(defaultState);

  const setDestinationId = (destinationId: string) => setState(s => ({ ...s, destinationId }));
  const setParty = (party: string) => setState(s => ({ ...s, party }));
  const setStartDate = (startDate: Date | null) => setState(s => ({ ...s, startDate }));
  const setEndDate = (endDate: Date | null) => setState(s => ({ ...s, endDate }));
  const setInterests = (interests: string[]) => setState(s => ({ ...s, interests }));
  const setBudget = (budget: string) => setState(s => ({ ...s, budget }));
  const reset = () => setState(defaultState);

  return (
    <TripPlanningContext.Provider
      value={{ ...state, setDestinationId, setParty, setStartDate, setEndDate, setInterests, setBudget, reset }}
    >
      {children}
    </TripPlanningContext.Provider>
  );
}

export const useTripPlanning = () => useContext(TripPlanningContext);
