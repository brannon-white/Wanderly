import { StyleSheet } from 'react-native';

const PURPLE = '#6A62B7';

export const ICON_COLOR = '#6A62B7';
export const ICON_COLOR_DIMMED = '#ccc';

export const makeScrollContentStyle = (bottomInset: number) => ({
  paddingBottom: bottomInset + 24,
});

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },

  itineraryContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  heroSection: {
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },

  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },

  headerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTextContainer: {
    position: 'absolute',
    bottom: 22,
    left: 20,
    right: 20,
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Map ───────────────────────────────────────────────────────────────
  mapSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  mapContainer: {
    width: '100%',
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ede7fa',
  },

  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // ── Date tabs ─────────────────────────────────────────────────────────
  dateSelector: {
    paddingVertical: 10,
  },

  dateSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  dateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },

  dateBtnActive: {
    backgroundColor: PURPLE,
  },

  dateBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },

  dateBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── Activity cards ────────────────────────────────────────────────────
  itineraryItems: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  itineraryItem: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },

  itemImage: {
    width: '100%',
    height: 190,
    resizeMode: 'cover',
  },

  itemDetails: {
    padding: 14,
  },

  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 8,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  ratingText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'SourceSans3-Regular',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  infoIconEl: {
    marginRight: 8,
  },

  infoText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'SourceSans3-Regular',
  },

  mapsLink: {
    fontSize: 14,
    color: PURPLE,
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Transport row ─────────────────────────────────────────────────────
  transportOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },

  transportOption: {
    alignItems: 'center',
    gap: 4,
  },

  transportTime: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },

  transportTimeDimmed: {
    color: '#ccc',
  },

  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  starIcon: {
    marginRight: 1,
  },

  headerRightIcons: {
    flexDirection: 'row',
    gap: 8,
  },

  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6A62B7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  // ── Legacy keys kept so other files don't break ───────────────────────
  heroOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },

  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  stars: {
    fontSize: 14,
    marginRight: 4,
  },

  infoIcon: {
    marginRight: 8,
    fontSize: 16,
  },
});
