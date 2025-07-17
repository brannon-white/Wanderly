import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  backgroundImage: {
    resizeMode: 'cover',
    borderRadius: 32,
  },
  heading: {
    position: 'absolute',
    top: 80,
    left: 24,
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  signUpButton: {
    width: 240,
    height: 56,
    backgroundColor: '#6A62B7',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signUpText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  signInButton: {
    width: 240,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#6A62B7',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
  },
});