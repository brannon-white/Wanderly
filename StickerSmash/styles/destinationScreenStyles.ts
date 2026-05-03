import { StyleSheet } from 'react-native';

const PRIMARY = '#6A62B7';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  heroImage: {
    width: '100%',
    height: 320,
    resizeMode: 'cover',
  },

  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },

  heroBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  heroRightBtns: {
    flexDirection: 'row',
    gap: 10,
  },

  // ── Saved toast ───────────────────────────────────────────────────────
  savedToast: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },

  savedToastText: {
    fontSize: 16,
    color: '#222',
    fontFamily: 'Merriweather_24pt-Bold',
  },

  // ── Content ───────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },

  title: {
    fontSize: 28,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 10,
  },

  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  flag: {
    fontSize: 18,
  },

  countryName: {
    fontSize: 15,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },

  description: {
    fontSize: 15,
    color: '#444',
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 24,
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 20,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 12,
  },

  galleryScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },

  galleryImage: {
    width: 140,
    height: 100,
    borderRadius: 14,
    marginRight: 12,
    resizeMode: 'cover',
  },

  // ── Bottom CTA ────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },

  ctaBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },

  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});
