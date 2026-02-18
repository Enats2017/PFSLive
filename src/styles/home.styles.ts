import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const homeStyles = StyleSheet.create({
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
  
  cardscetion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop:30
  },
  logo: {
    width: 100,
    height: 70,
  },
  textSection: {
    alignItems:"flex-start",  
  },
  title: {
    fontSize: typography.sizes.xxxl,
    marginBottom:10,
    color: colors.black,
    fontWeight:typography.weights.bold,
    letterSpacing: 1,
  },

  subtitle: {
   height:"10%",
    fontSize:typography.sizes.md ,
    textAlign: "center",
    color: "#ff3b30",
    letterSpacing: 2,
  },
    textContainer: {
    alignItems: "center",
    marginVertical: 15,
        
  },
  heading: {
    textAlign: "center",
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.gray600,
    width:"80%",
    marginBottom: 12,
  },
  smallText: {
    fontSize: typography.sizes.xl,
    fontWeight:typography.weights.semibold,
    color: colors.black,
  },
  
  buttonContainer:{
   paddingHorizontal:10,
   paddingTop:35 ,
  
  },
   button: {
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },

  buttonText: {
    color: colors.black,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },

});
