import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
 topBar: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: 16,
  marginBottom: 8,
  paddingHorizontal: 16,
  position: 'relative', // Needed for absolute centering
},
backArrow: {
  padding: 8,
  marginRight: 8,
  backgroundColor: 'rgba(255,255,255,0.7)',
  borderRadius: 20,
  zIndex: 2,
},
progressBarAbsoluteContainer: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1,
},
progressBarWrapper: {
  alignItems: 'center',
  justifyContent: 'center',
  height: 12,
  width: 180,
  position: 'relative',
},
progressBarBg: {
  width: '100%',
  height: 12,
  borderRadius: 6,
  backgroundColor: '#eaeaea',
  position: 'absolute',
  top: 0,
  left: 0,
},
progressBarFill: {
  width: '40%',
  height: 12,
  borderRadius: 6,
  backgroundColor: '#6A62B7',
  position: 'absolute',
  top: 0,
  left: 0,
},
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  heading: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 12,
    marginTop: 15,
    alignSelf: 'stretch',
  },
  headingEmoji: {
    fontSize: 32,
  },
  subheading: {
    fontSize: 18,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 32,
    lineHeight: 28,
    alignSelf: 'stretch',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 22,
    paddingHorizontal: 18,
    height: 56,
    marginBottom: 24,
  },
  searchIcon: {
    fontSize: 22,
    color: '#bdbdbd',
    marginRight: 10,
  },
  helperText: {
  color: '#888',
  fontSize: 16,
  textAlign: 'center',
  marginBottom: 8,
  fontFamily: 'SourceSans3-Regular',
},
  searchInput: {
    flex: 1,
    fontSize: 20,
    color: '#222',
    fontFamily: 'SourceSans3-Regular',
  },
prefsGrid: {
  width: '100%',
},
prefsRow: {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  marginBottom: 0,
},
prefButton: {
  flex: 1,
  borderWidth: 2,
  borderColor: '#eaeaea',
  borderRadius: 32,
  paddingVertical: 2,      // Decreased from 6
  paddingHorizontal: 10,   // Slightly decreased
  marginBottom: 10,        // Slightly decreased
  backgroundColor: '#fff',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 8,
  marginLeft: 8,
  minWidth: 0,
},
  prefButtonSelected: {
    borderColor: '#6A62B7',
    backgroundColor: '#f3f0ff',
  },
prefText: {
  fontSize: 16,            // Decreased from 18
  color: '#222',
  fontFamily: 'SourceSans3-Regular',
  fontWeight: '600',
  flexDirection: 'row',    // Add this
  alignItems: 'center',    // Add this
  flexWrap: 'nowrap',      // Add this
},
  prefTextSelected: {
    color: '#7c5cff',
    fontWeight: '700',
  },
prefEmoji: {
  fontSize: 16,            // Decreased from 18
  marginLeft: 4,           // Add a little space
},
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButton: {
    backgroundColor: '#6A62B7',
    borderRadius: 32,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
  },
});