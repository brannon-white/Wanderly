import React, { createContext, useContext, useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useDemo } from './DemoContext';
import { SavedItem } from '@/data/demoData';

type SavedContextType = {
  savedItems: SavedItem[];
  isSaved: (id: string) => boolean;
  toggleSaved: (item: SavedItem) => void;
};

const SavedContext = createContext<SavedContextType>({
  savedItems: [],
  isSaved: () => false,
  toggleSaved: () => {},
});

export const SavedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDemoMode } = useDemo();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    if (isDemoMode) return;
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(uid)
      .collection('savedItems')
      .onSnapshot((snapshot) => {
        if (!snapshot) return;
        setSavedItems(snapshot.docs.map((doc) => doc.data() as SavedItem));
      }, () => {});

    return unsubscribe;
  }, [isDemoMode]);

  const isSaved = (id: string) => savedItems.some((item) => item.id === id);

  const toggleSaved = (item: SavedItem) => {
    if (isSaved(item.id)) {
      setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
      if (!isDemoMode) {
        const uid = auth().currentUser?.uid;
        if (uid) {
          firestore().collection('users').doc(uid).collection('savedItems').doc(item.id).delete();
        }
      }
    } else {
      setSavedItems((prev) => [...prev, item]);
      if (!isDemoMode) {
        const uid = auth().currentUser?.uid;
        if (uid) {
          firestore().collection('users').doc(uid).collection('savedItems').doc(item.id).set(item);
        }
      }
    }
  };

  return (
    <SavedContext.Provider value={{ savedItems, isSaved, toggleSaved }}>
      {children}
    </SavedContext.Provider>
  );
};

export const useSaved = () => useContext(SavedContext);
