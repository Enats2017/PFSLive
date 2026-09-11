import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../services/tokenService';
import { useAuth } from '../context/AuthContext';

/**
 * The action offered alongside the "Session Expired" error screen.
 *
 * Lifted verbatim from useRegistrationHandler.handleUnauthorized so every
 * screen ends a dead session the same way: clear the credential stores, flip
 * AuthContext (which unmounts the auth-required screen group and detaches the
 * Firebase user id), then land on LoginScreen with no back history.
 *
 * The setTimeout is load-bearing: logout() remounts the navigator, and
 * resetting in the same tick targets the stack that is about to be torn down.
 */
export function useSessionExpired(): () => Promise<void> {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  return useCallback(async () => {
    await tokenService.removeToken();
    logout();
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    }, 50);
  }, [logout, navigation]);
}
