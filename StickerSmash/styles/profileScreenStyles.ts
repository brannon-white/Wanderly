import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f2ff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f4f2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Page header ──
  pageHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#f4f2ff',
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Merriweather_36pt-Bold',
    color: '#222',
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
    backgroundColor: '#f4f2ff',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Profile card (tap to edit) ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 16,
    shadowColor: '#6A62B7',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  profileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#6A62B7',
  },
  profileAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f0ff',
    borderWidth: 2,
    borderColor: '#6A62B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitials: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6A62B7',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  profileCardText: {
    marginLeft: 14,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'Merriweather_36pt-Bold',
    color: '#222',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: '#888',
  },

  // ── Settings section block ──
  section: {
    marginHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
    marginBottom: 32,
  },

  // ── Individual row ──
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsRowIcon: {
    marginRight: 14,
    width: 22,
  },
  settingsRowLabel: {
    fontSize: 17,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
    color: '#222',
  },
  settingsRowSubtitle: {
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
    color: '#aaa',
    marginTop: 2,
    maxWidth: 220,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 52,
  },

  // ── Sign out row ──
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 17,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
    color: '#E53935',
  },

  // ── Edit Profile Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#eaeaea',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  modalCancel: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
  },
  modalSave: {
    fontSize: 16,
    color: '#6A62B7',
    fontWeight: '700',
    fontFamily: 'SourceSans3-Regular',
  },
  modalAvatarContainer: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
    position: 'relative',
  },
  modalAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#6A62B7',
  },
  modalAvatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#f3f0ff',
    borderWidth: 2,
    borderColor: '#6A62B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6A62B7',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  modalAvatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#6A62B7',
    borderRadius: 12,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalAvatarHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#aaa',
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222',
    fontFamily: 'SourceSans3-Regular',
    borderWidth: 1,
    borderColor: '#eaeaea',
    justifyContent: 'center',
  },
});
