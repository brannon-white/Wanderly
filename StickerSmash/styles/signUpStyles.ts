import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#f6f4ff',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backgroundImage: {
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 1,
  },
topHeadingWrapper: {
  width: '100%',
  paddingHorizontal: 32,
  marginTop: 110, // Move text further down
  marginBottom: 12,
},
heading: {
  fontSize: 44, // Make it bigger
  fontFamily: 'Merriweather_36pt-Bold',
  color: '#fff',
  textAlign: 'left',
  lineHeight: 52, // Adjust for bigger text
  textShadowColor: 'rgba(0,0,0,0.15)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 6,
},
card: {
  width: '100%',
  height: 570, // or adjust to your preferred height (e.g., 520, 540, etc.)
  backgroundColor: '#fff',
  borderTopLeftRadius: 36,
  borderTopRightRadius: 36,
  paddingHorizontal: 24,
  paddingTop: 32,
  paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 8,
  position: 'absolute',
  bottom: 0,
  left: 0,
},
  subheading: {
    fontSize: 24,
    fontFamily: 'Merriweather_36pt-Bold', // Use your loaded Merriweather font
    color: '#222',
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 24,
    marginTop: 0,
    lineHeight: 28,
  },
  googleButton: {
    width: '100%',
    height: 48,
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  orText: {
    marginHorizontal: 8,
    color: '#888',
    fontWeight: '500',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: '#888',
    marginBottom: 4,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
    fontFamily: 'Merriweather_36pt-Bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#a9a9a9',
    paddingBottom: 2,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 4,
    color: '#222',
    backgroundColor: 'transparent',
    fontFamily: 'SourceSans3-Regular', // Use your loaded body font
  },
  signUpButton: {
    backgroundColor: '#6A62B7',
    borderRadius: 24,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
  },
});