import { StyleSheet } from "react-native";
import { colors, commonStyles } from '../styles/common.styles';

 export const favstyle = StyleSheet.create({
    
    wrapper: {
        paddingHorizontal: 8,
        paddingVertical: 5,
    },

    card: {
        backgroundColor: colors.white,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 4,
        maxHeight:100,
        paddingBottom:10,

    },

   
    headerLeft: {
        backgroundColor: colors.gray400,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        width: 120,
        zIndex: 3,
    },

    diagLeft: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderTopWidth: 33,
        borderRightWidth: 20,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderTopColor: colors.gray400,
        borderRightColor: 'transparent',
        zIndex: 2,
    },

    headerMiddle: {
        flex: 1,
    },

    diagRight: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderTopWidth: 33,
        borderRightWidth: 0,
        borderLeftWidth: 20,
        borderTopColor: colors.primary,
        borderLeftColor: 'transparent',
        zIndex: 2,
    },

    headerRight: {
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 14,
        paddingLeft: 4,
       width:120,
        
        zIndex: 1,
    },

    headerRightText: {
        color: '#FCEBEB',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.6,
    },

    body: {
        alignItems: 'center',            
    },

 })