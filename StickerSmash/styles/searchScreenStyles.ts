import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    fontFamily: 'SourceSans3-Regular',
    marginLeft: 8,
    paddingVertical: 0,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f0eeff',
    overflow: 'hidden',
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#ede9fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 14,
  },
  rowName: {
    fontSize: 16,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 3,
  },
  rowCountry: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 15,
    fontFamily: 'SourceSans3-Regular',
    marginTop: 60,
  },
});
