import { StyleSheet } from 'react-native';

const PRIMARY = '#6A62B7';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f2ff',
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
    fontSize: 28,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },

  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8e4ff',
    shadowColor: '#6A62B7',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  headerSpacer: {
    width: 40,
  },

  // ── Active / Passed toggle ────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#e8e4ff',
    borderRadius: 16,
    padding: 4,
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleBtnActive: {
    backgroundColor: PRIMARY,
  },

  toggleText: {
    fontSize: 15,
    fontFamily: 'SourceSans3-Regular',
    color: '#888',
  },

  toggleTextActive: {
    color: '#fff',
    fontFamily: 'Merriweather_24pt-Bold',
  },

  // ── Trip card ─────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  card: {
    marginBottom: 24,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },

  cardImage: {
    width: '100%',
    height: 210,
    resizeMode: 'cover',
  },

  cardContent: {
    backgroundColor: '#fff',
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

  cardTitle: {
    fontSize: 18,
    color: '#6A62B7',
    fontFamily: 'Merriweather_36pt-Bold',
    flexShrink: 1,
    marginRight: 8,
  },

  menuBtn: {
    padding: 4,
  },

  cardSubtitle: {
    fontSize: 13,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Empty state ───────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },

  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8e4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  emptyTitle: {
    fontSize: 26,
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

  emptyBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },

  emptyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});
