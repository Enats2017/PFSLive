import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { routeStyles } from '../styles/route.styles';

interface DistanceOption {
  id: string;
  label: string;
  value: number;
}

interface DistanceDropdownProps {
  onSelect?: (distance: number) => void;
}

export const DistanceDropdown: React.FC<DistanceDropdownProps> = ({ onSelect }) => {
  const { t } = useTranslation('route');
  
  const distances: DistanceOption[] = [
    { id: '1', label: '100 km', value: 100 },
    { id: '2', label: '75 km', value: 75 },
    { id: '3', label: '50 km', value: 50 },
    { id: '4', label: '25 km', value: 25 },
  ];

  const [selectedDistance, setSelectedDistance] = useState<DistanceOption>(distances[0]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (distance: DistanceOption) => {
    setSelectedDistance(distance);
    setIsOpen(false);
    if (onSelect) {
      onSelect(distance.value);
    }
  };

  return (
    <View style={routeStyles.distanceDropdown}>
      <TouchableOpacity
        style={routeStyles.dropdownButton}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={routeStyles.dropdownButtonText}>
          {selectedDistance.label}
        </Text>
        <Text style={routeStyles.dropdownArrow}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <ScrollView style={routeStyles.dropdownList}>
          {distances.map((distance) => (
            <TouchableOpacity
              key={distance.id}
              style={[
                routeStyles.dropdownItem,
                selectedDistance.id === distance.id && routeStyles.dropdownItemActive,
              ]}
              onPress={() => handleSelect(distance)}
            >
              <Text
                style={[
                  routeStyles.dropdownItemText,
                  selectedDistance.id === distance.id && routeStyles.dropdownItemTextActive,
                ]}
              >
                {distance.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};