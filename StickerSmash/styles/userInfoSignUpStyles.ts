import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 }, // was 24
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
  heading: { fontSize: 30, fontWeight: 'bold', color: '#222', marginBottom: 8, marginTop: 10 }, // was 12, 15
  headingEmoji: { fontSize: 32 },
  subheading: { fontSize: 18, color: '#888', marginBottom: 24, lineHeight: 28 }, // was 32
  avatarWrapper: { alignItems: 'center', marginBottom: 16 }, // was 24
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee' },
  editIcon: { position: 'absolute', right: 110, bottom: 10, backgroundColor: '#7c5cff', borderRadius: 16, padding: 6 },
  label: { fontSize: 18, fontWeight: 'bold', color: '#222', marginTop: 12, marginBottom: 4 }, // was 16, 6
  input: { backgroundColor: '#fafafa', borderRadius: 16, padding: 14, fontSize: 18, color: '#222', marginBottom: 10 }, // was 18, 12
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, // was 12
  flag: { fontSize: 28, marginRight: 8 },
continueButton: {
  backgroundColor: '#6A62B7',
  borderRadius: 40,
  width: 322,
  height: 70.714,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center', // <-- Add this line to center the button horizontally
  marginTop: 12,       // Optional: add some space above
  marginBottom: 12,    // Optional: add some space below
},
  continueButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
});