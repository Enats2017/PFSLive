import { View, Text } from "react-native";
import { PulsingDot } from "./PullingDot";

 export const LiveTrackingBar: React.FC = () => (
    <View style={{
        marginTop: 3,
        marginBottom: 5,
        borderRadius: 6,
        alignItems:"center", 
        flexDirection: 'row', 
        gap: 6,
    }}>
        <PulsingDot/>
      

        <Text style={{
            color: '#FF3B30',
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.5,
            textAlign:"center",
        }}>
            LIVE TRACKING 
        </Text>
    </View>
);