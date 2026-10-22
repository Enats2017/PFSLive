import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardEvent,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';
import { palette, fonts, shadows, radii, space, withAlpha } from '../styles/common.styles';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import { useModalSideInsets } from '../hooks/useLandscapeSidePadding';

// ─── Types ───────────────────────────────────────────────────────
export interface Country {
  country_id: string;
  name: string;
  iso_code_2: string;
  iso_code_3: string;
}

// ✅ All UI strings passed from parent so CountrySelector works in any language
// without coupling the component to i18n directly.
export interface CountrySelectorI18n {
  title: string;            // 'Select Country'
  searchPlaceholder: string; // 'Search country...'
  resultOne: string;        // '{{count}} country found'
  resultMany: string;       // '{{count}} countries found'
  retry: string;            // 'Retry'
  errorLoad: string;        // 'Failed to load countries.'
  errorNetwork: string;     // 'Cannot reach server. Check your connection.'
  emptyResult: string;      // 'No countries found for "{{search}}"'
}

// ✅ Default English strings — used when no i18n prop is passed
const DEFAULT_I18N: CountrySelectorI18n = {
  title: 'Select Country',
  searchPlaceholder: 'Search country...',
  resultOne: '{{count}} country found',
  resultMany: '{{count}} countries found',
  retry: 'Retry',
  errorLoad: 'Failed to load countries.',
  errorNetwork: 'Cannot reach server. Check your connection.',
  emptyResult: 'No countries found for "{{search}}"',
};

interface CountrySelectorProps {
  label?: string;
  value: string;           // country name to display
  onSelect: (country: Country) => void;
  error?: string;
  required?: boolean;
  isoCode?: string;
  i18n?: CountrySelectorI18n;  // ✅ translatable strings from parent
}

// ─── Flag emoji from iso_code_2 ──────────────────────────────────
const getFlagEmoji = (isoCode2: string): string => {
  try {
    return isoCode2
      .toUpperCase()
      .split('')
      .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
      .join('');
  } catch {
    return '🏳️';
  }
};

const COLORS = {
  ERROR:        palette.danger,        // #DC143C
  PRIMARY:      palette.navy,      // #0f2a3f
  GRAY_LIGHT:   palette.inputBorder,  // #d1d5db
  GRAY_MED:     palette.placeholder,      // #9ca3af
  GRAY_DARK:    palette.ink,      // #111827
  WHITE:        palette.surface,        // #ffffff
  BORDER_LIGHT: palette.border, // #e5e7eb
  BG_SELECTED:  palette.noticeBg,  // #fff5f5
  BG_ITEM:      palette.fill,      // #f3f4f6
} as const;

// ════════════════════════════════════════════════════════════════
//  CountrySelector
// ════════════════════════════════════════════════════════════════
const CountrySelector: React.FC<CountrySelectorProps> = ({
  label = 'Country',
  value,
  onSelect,
  error,
  required = false,
  isoCode,
  i18n = DEFAULT_I18N,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filtered, setFiltered] = useState<Country[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  // Picker sheet keyboard handling (audit 2026-10-22): the sheet was a fixed
  // 85% tall with an autoFocused search and no keyboard avoidance — in
  // landscape the keyboard covered the whole country list. Now the sheet sits
  // above the keyboard and shrinks to fit, and search only autoFocuses in
  // portrait.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // landscape: the picker sheet clear of the camera / nav bar (modals are outside any SafeAreaView)
  const modalSides = useModalSideInsets();
  const isLandscape = windowWidth > windowHeight;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!showModal) return;
    // the keyboard may already be up (another field) when the picker opens
    setKeyboardHeight(Keyboard.isVisible() ? Keyboard.metrics()?.height ?? 0 : 0);
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); setKeyboardHeight(0); };
  }, [showModal]);

  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value || showModal ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, showModal]);

  const labelStyle = {
    position: 'absolute' as const,
    left: 44,
    top: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [17, -9] }),
    fontSize: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [COLORS.GRAY_MED, error ? COLORS.ERROR : COLORS.PRIMARY],
    }),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 4,
    zIndex: 1,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 0.3,
  };

  // ── Fetch countries ──────────────────────────────────────────
  const fetchCountries = async () => {
    if (countries.length > 0) return;
    try {
      setLoading(true);
      setFetchError('');
      const headers = await API_CONFIG.getHeaders();
      const response = await axios.get(
        getApiEndpoint(API_CONFIG.ENDPOINTS.COUNTRIES),
        { headers, timeout: API_CONFIG.TIMEOUT }
      );
      if (response.data.success) {
        const list: Country[] = response.data.data.countries;
        setCountries(list);
        setFiltered(list);
      } else {
        setFetchError(i18n.errorLoad);
      }
    } catch {
      setFetchError(i18n.errorNetwork);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setShowModal(true);
    setSearch('');
    fetchCountries();
  };

  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);
      setFiltered(
        text.trim() === ''
          ? countries
          : countries.filter((c) =>
            c.name.toLowerCase().includes(text.toLowerCase())
          )
      );
    },
    [countries]
  );

  const handleSelect = (country: Country) => {
    setSelectedCountry(country);
    onSelect(country);
    setShowModal(false);
    setSearch('');
  };

  const handleClear = () => {
    setSelectedCountry(null);
    onSelect({ country_id: '', name: '', iso_code_2: '', iso_code_3: '' });
  };

  // ✅ Build result count string using i18n template
  const resultCountText = filtered.length === 1
    ? i18n.resultOne.replace('{{count}}', String(filtered.length))
    : i18n.resultMany.replace('{{count}}', String(filtered.length));

  // ✅ Build empty result string using i18n template
  const emptyResultText = i18n.emptyResult.replace('{{search}}', search);

  const borderColor = error ? COLORS.ERROR : showModal ? COLORS.PRIMARY : palette.inputBorder;
  const iconColor = error ? COLORS.ERROR : showModal ? COLORS.PRIMARY : palette.inputBorder;

  return (
    <View style={styles.wrapper}>

      {/* ── Tappable Field ── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpen}
        style={[
          styles.container,
          { borderColor },
          showModal && styles.containerFocused,
        ]}
      >
        {/* Left: globe icon OR flag when selected */}
        <View style={styles.iconLeft}>
          {(selectedCountry || isoCode) ? (
            <Text style={styles.flagInField}>
              {getFlagEmoji(selectedCountry?.iso_code_2 ?? isoCode ?? '')}
            </Text>
          ) : (
            <Ionicons name="globe-outline" size={18} color={iconColor} />
          )}
        </View>

        {/* Floating Label */}
        <Animated.Text style={labelStyle}>
          {label}
          {required && <Animated.Text style={{ color: palette.danger }}> *</Animated.Text>}
        </Animated.Text>

        {/* Selected value */}
        {/* 2 lines + tighter right padding (was 1 line, 44/44): in EditProfile's
            half-width field at 320pt the value got ~43pt and "France" was cut.
            Right padding only clears the icon actually shown (chevron 18 / X 20)
            (audit 2026-10-22). */}
        <Text
          style={[
            styles.valueText,
            { paddingRight: selectedCountry ? 38 : 34 },
            !value && styles.placeholder,
          ]}
          numberOfLines={2}
        >
          {value || ''}
        </Text>

        {/* Right: clear X if selected, else chevron */}
        <View style={styles.iconRight}>
          {selectedCountry ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={palette.placeholder} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down-outline" size={18} color={iconColor} />
          )}
        </View>
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <Text style={styles.errorText}>
          <Ionicons name="alert-circle-outline" size={11} color={palette.danger} /> {error}
        </Text>
      )}

      {/* ══════════════════════════════════════════════════════════
       *  MODAL
       * ══════════════════════════════════════════════════════════ */}
      <Modal supportedOrientations={MODAL_ORIENTATIONS}
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalOverlay, modalSides, { paddingBottom: keyboardHeight }]}>
          <View
            style={[
              styles.modalContainer,
              { height: Math.min(windowHeight * 0.85, windowHeight - keyboardHeight - insets.top - 8) },
            ]}
          >

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{i18n.title}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={palette.navy} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={palette.placeholder} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={i18n.searchPlaceholder}
                placeholderTextColor={palette.placeholder}
                value={search}
                onChangeText={handleSearch}
                // portrait only: in landscape the keyboard would hide the list
                autoFocus={!isLandscape}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={18} color={palette.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Result count */}
            {!loading && !fetchError && (
              <Text style={styles.resultCount}>{resultCountText}</Text>
            )}

            {loading ? (
              <ActivityIndicator size="large" color={palette.navy} style={{ marginTop: 40 }} />
            ) : fetchError ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="wifi-outline" size={40} color={palette.inputBorder} />
                <Text style={styles.emptyText}>{fetchError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchCountries}>
                  <Text style={styles.retryText}>{i18n.retry}</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={40} color={palette.inputBorder} />
                <Text style={styles.emptyText}>{emptyResultText}</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.country_id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                renderItem={({ item }) => {
                  const isSelected = selectedCountry?.country_id === item.country_id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.countryItem,
                        isSelected && styles.countryItemSelected,
                      ]}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.flag}>{getFlagEmoji(item.iso_code_2)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.countryName,
                            isSelected && styles.countryNameSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.isoCode}>{item.iso_code_2} · {item.iso_code_3}</Text>
                      </View>

                      {value === item.name && (
                        <Ionicons name="checkmark-circle" size={20} color={palette.navy} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}

          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginVertical: 8 },
  container: {
    ...shadows.card,

    flexDirection: 'row',
    alignItems: 'center',
    // minHeight (was a fixed height): with larger iOS text the field grows
    // instead of clipping the chosen country (2026-10-22).
    minHeight: 56,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderRadius: 14,
    borderColor: palette.inputBorder,
    backgroundColor: palette.surface,
  },
  containerFocused: {
    ...shadows.card,
  },

  iconLeft: { position: 'absolute', left: 14, zIndex: 2 },
  iconRight: { position: 'absolute', right: 14, zIndex: 2 },
  flagInField: { fontFamily: fonts.body,
        fontSize: 20 },
  valueText: {
    flex: 1,
    fontFamily: fonts.body,
        fontSize: 15,
    color: palette.ink,
    paddingLeft: 44,
    paddingRight: 44, // overridden inline to fit the right icon actually shown
    paddingTop: 8,
  },
  placeholder: { color: palette.placeholder },
  errorText: {
    marginTop: 4,
    marginLeft: 4,
    fontFamily: fonts.bodyMedium,
        fontSize: 12,
    color: palette.danger,
    },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(palette.ink, 0.6),
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // height set inline: 85% of the window, capped to the space above the keyboard
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.fill,
  },
  modalTitle: { fontFamily: fonts.display,
        fontSize: 20, color: palette.ink },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.fill,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  selectedBannerFlag: { fontFamily: fonts.body,
        fontSize: 26, marginRight: 12 },
  selectedBannerLabel: { fontFamily: fonts.bodySemi,
        fontSize: 12, color: palette.navy, marginBottom: 2 },
  selectedBannerName: { fontFamily: fonts.display,
        fontSize: 15, color: palette.ink, },
  clearButton: {
    paddingHorizontal: space.xl,
    paddingVertical: 8,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  clearButtonText: { fontFamily: fonts.bodyMedium,
        fontSize: 14, color: palette.textMuted, },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: space.xl,
    minHeight: 46,
    paddingVertical: 4,
    backgroundColor: palette.page,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: fonts.body,
        fontSize: 15, color: palette.ink },
  resultCount: {
    fontFamily: fonts.body,
        fontSize: 13,
    color: palette.placeholder,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countryItemSelected: { backgroundColor: palette.page },
  flag: { fontFamily: fonts.body,
        fontSize: 26, marginRight: 16, width: 36, textAlign: 'center' },
  countryName: { fontFamily: fonts.body,
        fontSize: 15, color: palette.navy, },
  countryNameSelected: { color: palette.navy, fontFamily: fonts.bodySemi,
        fontSize: 14,
        },
  isoCode: { fontFamily: fonts.body,
        fontSize: 12, color: palette.placeholder, marginTop: 2 },
  separator: { height: 1, backgroundColor: palette.fill, marginLeft: 72 },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.navy,
    borderRadius: radii.pill,
    paddingHorizontal: space.xl,
    paddingVertical: 4,
    gap: 4,
  },
  selectedBadgeText: { fontFamily: fonts.bodySemi,
        fontSize: 13, color: palette.surface, },
  unselectedBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: space.xl,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  unselectedBadgeText: { fontFamily: fonts.body,
        fontSize: 13, color: palette.placeholder, },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { fontFamily: fonts.body,
        fontSize: 14, color: palette.placeholder, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 8, backgroundColor: palette.navy, borderRadius: 10 },
  retryText: { color: palette.surface, fontFamily: fonts.bodySemi,
        fontSize: 14 },
});

export default CountrySelector;