// ResultDetails.styles.ts
import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const resultInfoStyles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 13,
    
    },
    headerBackBtn: {
        width: 32,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    headerBib: {
        fontSize: 13,
        color: '#666',
        marginTop: 1,
    },
    headerRightBtn: {
        width: 32,
        alignItems: 'flex-end',
    },

    
    tabBarScroll: {
        flexGrow: 0,
    },
    tabBarContent: {
        flexDirection: 'row',
        paddingHorizontal: 4,
        paddingBottom:6,
    },
    tabItem: {
        paddingHorizontal: 18,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: width / 3,          // show ~2.5 tabs — implies more to scroll
        position: 'relative',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#999',
    },
    tabTextActive: {
        color: '#111',
        fontWeight: '700',
    },
    tabUnderline: {
        position: 'absolute',
        bottom: 0,
        left: 8,
        right: 8,
        height: 3,
        borderRadius: 2,
    },

    // ── Page FlatList ─────────────────────────────────────────────────────
    pageList: {
        flex: 1,
    },
    page: {
        width,
        flex: 1,
    },
});