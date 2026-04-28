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
  const [isDemoMode, setIsDemoMode] = useState(false);

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
