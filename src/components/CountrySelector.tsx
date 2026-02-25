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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../constants/config';

// ─── Types ───────────────────────────────────────────────────────
export interface Country {
  country_id: string;
  name: string;
  iso_code_2: string;
  iso_code_3: string;
}

interface CountrySelectorProps {
  label?: string;
  value: string;           // country name to display
  onSelect: (country: Country) => void;
  error?: string;
  required?: boolean;
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

// ════════════════════════════════════════════════════════════════
//  CountrySelector
// ════════════════════════════════════════════════════════════════
const CountrySelector: React.FC<CountrySelectorProps> = ({
  label = 'Country',
  value,
  onSelect,
  error,
  required = false,
}) => {
  const [showModal, setShowModal]         = useState(false);
  const [countries, setCountries]         = useState<Country[]>([]);
  const [filtered, setFiltered]           = useState<Country[]>([]);
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(false);
  const [fetchError, setFetchError]       = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

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
      outputRange: ['#9ca3af', error ? '#ef4444' : '#6366f1'],
    }),
    backgroundColor: '#ffffff',
    paddingHorizontal: 4,
    zIndex: 1,
    fontWeight: '500' as const,
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
        setFetchError('Failed to load countries.');
      }
    } catch {
      setFetchError('Cannot reach server. Check your connection.');
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

  const borderColor = error ? '#ef4444' : showModal ? '#ef4444' : '#d1d5db';
  const iconColor   = error ? '#ef4444' : showModal ? '#ef4444' : '#9ca3af';

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
          {selectedCountry ? (
            <Text style={styles.flagInField}>
              {getFlagEmoji(selectedCountry.iso_code_2)}
            </Text>
          ) : (
            <Ionicons name="globe-outline" size={18} color={iconColor} />
          )}
        </View>

        {/* Floating Label */}
        <Animated.Text style={labelStyle}>
          {label}
          {required && <Animated.Text style={{ color: '#ef4444' }}> *</Animated.Text>}
        </Animated.Text>

        {/* Selected value */}
        <Text
          style={[styles.valueText, !value && styles.placeholder]}
          numberOfLines={1}
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
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down-outline" size={18} color={iconColor} />
          )}
        </View>
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <Text style={styles.errorText}>
          <Ionicons name="alert-circle-outline" size={11} color="#ef4444" /> {error}
        </Text>
      )}

      {/* ══════════════════════════════════════════════════════════
       *  MODAL
       * ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#6366f1" />
              </TouchableOpacity>
            </View>

            {/* Selected banner — shows which country is currently chosen */}
            {/* {selectedCountry && (
              <View style={styles.selectedBanner}>
                <Text style={styles.selectedBannerFlag}>
                  {getFlagEmoji(selectedCountry.iso_code_2)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedBannerLabel}>Currently Selected</Text>
                  <Text style={styles.selectedBannerName}>{selectedCountry.name}</Text>
                </View>
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )} */}

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country..."
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={handleSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Result count */}
            {!loading && !fetchError && (
              <Text style={styles.resultCount}>
                {filtered.length} {filtered.length === 1 ? 'country' : 'countries'} found
              </Text>
            )}

            {loading ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
            ) : fetchError ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="wifi-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>{fetchError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchCountries}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>No countries found for "{search}"</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.country_id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                      <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
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
  wrapper: { marginVertical: 10 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 0,
  },
  containerFocused: { shadowOpacity: 0.12, elevation: 3 },
 
  iconLeft: { position: 'absolute', left: 14, zIndex: 2 },
  iconRight: { position: 'absolute', right: 14, zIndex: 2 },
  flagInField: { fontSize: 20 },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingLeft: 44,
    paddingRight: 44,
    paddingTop: 6,
  },
  placeholder: { color: '#9ca3af' },
  errorText: {
    marginTop: 5,
    marginLeft: 4,
    fontSize: 11.5,
    color: '#ef4444',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  selectedBannerFlag: { fontSize: 28, marginRight: 12 },
  selectedBannerLabel: { fontSize: 11, color: '#6366f1', fontWeight: '600', marginBottom: 2 },
  selectedBannerName: { fontSize: 15, color: '#111827', fontWeight: '600' },
  clearButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  clearButtonText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },

  // ── Search ───────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  resultCount: {
    fontSize: 12,
    color: '#9ca3af',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countryItemSelected: { backgroundColor: '#fafafe' },
  flag: { fontSize: 26, marginRight: 14, width: 36, textAlign: 'center' },
  countryName: { fontSize: 15, color: '#111827', fontWeight: '400' },
  countryNameSelected: { color: '#6366f1', fontWeight: '600' },
  isoCode: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 70 },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  selectedBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  unselectedBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unselectedBadgeText: { fontSize: 12, color: '#9ca3af', fontWeight: '400' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { fontSize: 14, color: '#9ca3af', marginTop: 12, textAlign: 'center', paddingHorizontal: 30 },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#6366f1', borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

export default CountrySelector;
