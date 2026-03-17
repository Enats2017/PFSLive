import { StyleSheet, Dimensions } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const forgotStyles = StyleSheet.create({
      container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
    },

      progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f3f4f6',
  },
  progressActive: {
    backgroundColor: '#FF5722',
  },
  scroll: {
    flexGrow: 1,
    paddingVertical: 16,
  },

     iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff5f0',
        borderWidth: 2,
        borderColor: '#ffe0d6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },

     form: {
        width: '100%',
    },
       backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6,
    },
        email: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 28,
        marginTop: 4,
    },

     otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 12,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1.5,
        borderRadius: 12,
        borderColor: '#d1d5db',
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        backgroundColor: '#fff',
        textAlign: 'center',
    },
    otpFilled: {
        borderColor: colors.primaryLight,
        backgroundColor: '#fff5f0',
    },
    otpError: {
        borderColor: colors.participantColor,
        backgroundColor: '#fff5f5',
    },
    errorText: {
        fontSize: 13,
        color: colors.primaryDark,
        textAlign: 'center',
        marginBottom: 12,
        fontWeight: '500',
    },
      resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop:spacing.xl,
        marginBottom: 10,
    },
      resendLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    resendLink: {
        fontSize: 14,
        color: '#FF5722',
        fontWeight: '700',
    },
    countdown: {
        fontSize: 14,
        color: '#9ca3af',
        fontWeight: '500',
    },
    buttonDisabled: { opacity: 0.7 },
   
   

})