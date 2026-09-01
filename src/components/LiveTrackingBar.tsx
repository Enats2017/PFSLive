import { View, Text } from "react-native";
import { PulsingDot } from "./PullingDot";
import { palette, fonts } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

 export const LiveTrackingBar: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={{
        marginTop: 4,
        marginBottom: 4,
        borderRadius: 10,
        alignItems:"center", 
        flexDirection: 'row', 
        gap: 6,
    }}>
        <PulsingDot/>
      

        <Text style={{
            color: palette.danger,
            fontFamily: fonts.bodySemi,
        fontSize: 12,
            letterSpacing: 1.5,
            textAlign:"center",
        }}>
            {t('livetracking:bar.label')}
        </Text>
    </View>
  );
};
