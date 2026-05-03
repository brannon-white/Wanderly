import { StyleSheet } from 'react-native';

export const PRIMARY = '#6A62B7';
export const PRIMARY_LIGHT = '#f3f0ff';
export const PRIMARY_BORDER = '#6A62B7';
export const GRAY_BG = '#fafafa';
export const BORDER_COLOR = '#eaeaea';
export const TEXT_DARK = '#222';
export const TEXT_GRAY = '#888';

export const shared = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── Top bar (back + progress) ────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },

  // ── Content ───────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  heading: {
    fontSize: 28,
    color: TEXT_DARK,
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 10,
    marginTop: 8,
    lineHeight: 36,
  },
  subheading: {
    fontSize: 15,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 28,
    lineHeight: 22,
  },

  // ── Option cards (for party & budget) ────────────────────────────────
  optionCard: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  optionCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#fff',
  },
  optionTitle: {
    fontSize: 17,
    color: TEXT_DARK,
    fontFamily: 'Merriweather_24pt-Bold',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: PRIMARY,
  },
  optionSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },

  // ── Bottom bar & button ───────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  continueBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});
