import { StyleSheet, Dimensions } from 'react-native';

const PRIMARY = '#6A62B7';
const { width } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(width * 0.72);

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // ── Overlay header (sits above scroll) ───────────────────────────────
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    zIndex: 20,
  },

  savedToastText: {
    fontSize: 16,
    color: '#222',
    fontFamily: 'Merriweather_24pt-Bold',
  },

  // ── Scroll + hero ─────────────────────────────────────────────────────
  scrollContent: {
    paddingBottom: 110,
  },

  heroWrapper: {
    width: '100%',
    height: HERO_HEIGHT,
  },

  heroImage: {
    width: '100%',
    height: HERO_HEIGHT,
    resizeMode: 'cover',
  },

  heroPlaceholder: {
    backgroundColor: '#c8c0e8',
  },

  // ── Content card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },

  title: {
    fontSize: 28,
    color: '#111',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 10,
    lineHeight: 36,
  },

  // ── Country row ───────────────────────────────────────────────────────
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  flagEmoji: {
    fontSize: 20,
  },

  flagDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e55',
  },

  countryName: {
    fontSize: 15,
    color: '#444',
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Description ───────────────────────────────────────────────────────
  description: {
    fontSize: 15,
    color: '#444',
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 25,
    marginBottom: 24,
  },

  // ── Gallery ───────────────────────────────────────────────────────────
  galleryBlock: {
    marginBottom: 24,
  },

  galleryHeader: {
    fontSize: 18,
    color: '#111',
    fontFamily: 'Merriweather_24pt-Bold',
    marginBottom: 14,
  },

  galleryRow: {
    gap: 10,
  },

  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    resizeMode: 'cover',
  },

  // ── Content sections ──────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 16,
    color: '#111',
    fontFamily: 'Merriweather_24pt-Bold',
    marginBottom: 6,
  },

  sectionText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 23,
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
