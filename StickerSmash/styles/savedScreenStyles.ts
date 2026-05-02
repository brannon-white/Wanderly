import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 20,
  },

  headerTitle: {
    fontSize: 26,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },

  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 40,
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // ── Card — matches the home page recommendedCard pattern ──────────────
  card: {
    marginBottom: 20,
    borderRadius: 22,
    backgroundColor: '#b7aee2',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  imageWrapper: {
    position: 'relative',
  },

  cardImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },

  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 14,
    backgroundColor: '#b7aee2',
    borderRadius: 16,
    padding: 4,
  },

  // Lavender content footer — overlaps the image slightly like home cards
  cardContent: {
    backgroundColor: '#D0CBFF',
    borderRadius: 22,
    padding: 14,
    marginTop: -20,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  cityName: {
    fontSize: 18,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },

  menuBtn: {
    padding: 4,
  },

  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  flag: {
    fontSize: 16,
  },

  countryName: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Empty state ───────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },

  emptyText: {
    fontSize: 18,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },

  emptySubtext: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
