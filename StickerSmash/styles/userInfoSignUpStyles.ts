import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  progressBarWrapper: { alignItems: 'center', marginTop: 24, marginBottom: 16 },
  progressBarBg: { width: '60%', height: 12, borderRadius: 6, backgroundColor: '#eaeaea' },
  progressBarFill: { width: '40%', height: 12, borderRadius: 6, backgroundColor: '#7c5cff', position: 'absolute', top: 0, left: '20%' },
  heading: { fontSize: 30, fontWeight: 'bold', color: '#222', marginBottom: 12, marginTop: 15 },
  headingEmoji: { fontSize: 32 },
  subheading: { fontSize: 18, color: '#888', marginBottom: 32, lineHeight: 28 },
  avatarWrapper: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee' },
  editIcon: { position: 'absolute', right: 110, bottom: 10, backgroundColor: '#7c5cff', borderRadius: 16, padding: 6 },
  label: { fontSize: 18, fontWeight: 'bold', color: '#222', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#fafafa', borderRadius: 16, padding: 18, fontSize: 18, color: '#222', marginBottom: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  flag: { fontSize: 28, marginRight: 8 },
  continueButton: { backgroundColor: '#7c5cff', borderRadius: 32, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  continueButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
});