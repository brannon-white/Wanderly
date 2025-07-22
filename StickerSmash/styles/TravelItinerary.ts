import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  itineraryContainer: {
    maxWidth: 375,
    backgroundColor: 'white',
    fontFamily: 'System',
  },
  
  heroSection: {
    position: 'relative',
    height: 300,
    overflow: 'hidden',
  },
  
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  heroOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    color: 'white',
  },
  
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  
  heroSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  
  mapSection: {
    padding: 20,
  },
  
  mapContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  
  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  dateSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  
  dateBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  
  dateBtnActive: {
    backgroundColor: '#00c896',
  },
  
  dateBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  
  dateBtnTextActive: {
    color: 'white',
  },
  
  itineraryItems: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  itineraryItem: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  itemImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  
  itemDetails: {
    padding: 16,
  },
  
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  stars: {
    fontSize: 14,
    marginRight: 8,
  },
  
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  infoIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  
  infoText: {
    fontSize: 14,
    color: '#333',
  },
  
  mapsLink: {
    fontSize: 14,
    color: '#00c896',
  },
  
  transportOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  
  transportOption: {
    alignItems: 'center',
  },
  
  transportIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  
  transportTime: {
    fontSize: 12,
    color: '#666',
  },
});