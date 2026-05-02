import React, { createContext, useContext, useState } from 'react';

type DemoContextType = {
  isDemoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
};

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  enableDemoMode: () => {},
  disableDemoMode: () => {},
});

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start in demo mode during development so reloads and fresh installs
  // don't drop you back to the auth screen.
  const [isDemoMode, setIsDemoMode] = useState(__DEV__);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        enableDemoMode: () => setIsDemoMode(true),
        disableDemoMode: () => setIsDemoMode(false),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);
