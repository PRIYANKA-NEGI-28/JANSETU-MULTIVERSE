import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unavailable' | 'loading';

interface LocationState {
  lat: number | null;
  lng: number | null;
  permission: LocationPermission;
}

interface LocationContextValue extends LocationState {
  requestLocation: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    permission: 'loading',
  });

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      permission: 'granted',
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === 1) {
      // PERMISSION_DENIED
      setState(prev => ({ ...prev, permission: 'denied' }));
    } else if (error.code === 2) {
      // POSITION_UNAVAILABLE
      setState(prev => ({ ...prev, permission: 'unavailable' }));
    } else if (error.code === 3) {
      // TIMEOUT — retry once with enableHighAccuracy: false
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              permission: 'granted',
            });
          },
          () => {
            setState(prev => ({ ...prev, permission: 'denied' }));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        setState(prev => ({ ...prev, permission: 'denied' }));
      }
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, permission: 'unavailable' }));
      return;
    }
    setState(prev => ({ ...prev, permission: 'loading' }));
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [handleSuccess, handleError]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, permission: 'unavailable' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [handleSuccess, handleError]);

  return (
    <LocationContext.Provider value={{ ...state, requestLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
