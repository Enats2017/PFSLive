import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const eventStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    justifyContent:"flex-start",
    
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  section:{
    alignItems:"center",
    marginTop:spacing.lg
  },

})