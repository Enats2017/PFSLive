import Toast from "react-native-toast-message";

export const toastSuccess = (title:string, msg:string = "") => {
  Toast.show({
    type: "success",
    text1: title,
    text2: msg,
    position: "top",
  });
};

export const toastError = (title:string, msg:string = "") => {
  Toast.show({
    type: "error",
    text1: title,
    text2: msg,
    position: "top",
  });
};

export const toastInfo = (title:string, msg:string = "") => {
  Toast.show({
    type: "info",
    text1: title,
    text2: msg,
    position: "top",
  });
};

export const toastWarning = (title:string, msg:string = "") => {
  Toast.show({
    type: "warning",
    text1: title,
    text2: msg,
    position: "top",
  });
};
