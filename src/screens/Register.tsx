import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import { AppHeader } from '../components/common/AppHeader';
import { RegisterProps } from '../types/navigation';
import FloatingLabelInput from '../components/FloatingLabelInput';
import CountrySelector from '../components/CountrySelector';
import { Country } from '../components/CountrySelector';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles } from '../styles/Register.styles';
import { authService } from '../services/authService';
import { validateRegisterForm } from '../services/Registervalidation';
import { toastError, toastSuccess } from '../../utils/toast';

const Register: React.FC<RegisterProps> = ({ navigation }) => {
    const { t } = useTranslation(['register', 'common']);
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [city, setCity] = useState('');
    const [dob, setDob] = useState('');
    const [countryId, setCountryId] = useState('');
    const [countryName, setCountryName] = useState('');
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const [profileImage, setProfileImage] = useState("");
    const [gender, setGender] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    console.log(countryId);

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            toastError(t('register:alerts.galleryPermission'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setProfileImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        const validationErrors = validateRegisterForm({
            firstname, lastname, email, password,
            countryId, city, dob, gender, acceptedTerms,
        }, t);

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);

        try {
            // 2. Call authService.register
            const response = await authService.register({
                firstname,
                lastname,
                email,
                password,
                country_id: countryId,
                city,
                dob,
                gender,
                profileImage,
            });

            if (response.success && response.data?.verification_token) {
                navigation.navigate('OTPVerificationScreen', {
                    email: response.data?.email ?? email,
                    verification_token: response.data?.verification_token,
                });
            }

        } catch (error: any) {
            const data = error.response?.data;
            if (data?.error === 'email_exists') {
                setErrors({ email: 'This email is  registered' });
            } else if (data?.error === 'device_already_registered') {
                setErrors({
                    device: 'This device is already linked to an account. Please login instead.'
                });
            }
            else if (data?.error === 'device_not_allowed') {
                toastError(t('register:alerts.deviceNotAllowed'), t('register:alerts.deviceNotAllowedMessage'));
            } else if (error.request) {
                toastError(t('register:alerts.noConnection'),
                    t('register:alerts.noConnectionMessage'));
            } else {
                toastError(t('register:alerts.genericError'),
                    t('register:alerts.genericErrorMessage'));
            }

        } finally {
            setLoading(false);
        }
    };


    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingBottom: 60,
                        flexGrow: 1,
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                >
                    <View style={{ paddingHorizontal: 15 }}>
                        <View style={registerStyles.imagesection}>
                            <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                                <View style={registerStyles.imageWrapper}>
                                    {profileImage ? (
                                        <>
                                            <Image
                                                source={{ uri: profileImage }}
                                                style={registerStyles.profileImage}
                                            />
                                            <TouchableOpacity
                                                style={registerStyles.removeIcon}
                                                onPress={() => setProfileImage('')}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="close" size={14} color="#FF5722" />
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <>

                                            <View style={registerStyles.placeholder}>
                                                <Ionicons name="person-outline" size={40} color="#9ca3af" />
                                            </View>
                                            <View style={registerStyles.cameraIcon}>
                                                <Ionicons name="camera-outline" size={18} color="#fff" />
                                            </View>
                                        </>
                                    )}

                                </View>
                            </TouchableOpacity>
                            <Text style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                                {t('register:uploadPhoto')}
                            </Text>
                        </View>
                        <FloatingLabelInput
                            label={t('firstName')}
                            value={firstname}
                            onChangeText={setFirstname}
                            iconName="person-outline"
                            required
                            error={errors.firstname}

                        />
                        <FloatingLabelInput
                            label={t('lastName')}
                            value={lastname}
                            onChangeText={setLastname}
                            iconName="people-outline"
                            required
                            error={errors.lastname}
                        />
                        <FloatingLabelInput
                            label={t('email')}
                            value={email}
                            onChangeText={setEmail}
                            iconName="mail-outline"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            required
                            error={errors.email}
                        />
                        <FloatingLabelInput
                            label={t('password')}
                            value={password}
                            onChangeText={setPassword}
                            iconName="lock-closed-outline"
                            isPassword
                            required
                            error={errors.password}
                        />
                        <CountrySelector
                            label={t('country')}
                            value={countryName}
                            onSelect={(country) => {
                                setCountryId(country.country_id);
                                setCountryName(country.name);
                            }}
                            required
                            error={errors.country}
                        />
                        <FloatingLabelInput
                            label={t('city')}
                            value={city}
                            onChangeText={setCity}
                            iconName="location-outline"
                            error={errors.city}
                        />
                        <FloatingLabelInput
                            label={t('dateOfBirth')}
                            value={dob}
                            onChangeText={setDob}
                            iconName="calendar-outline"
                            isDatePicker
                            required
                            error={errors.dob}
                        />
                        <FloatingLabelInput
                            label={t('register:Gender.gender')}
                            value={gender}
                            onChangeText={setGender}
                            iconName="people-outline"
                            isDropdown
                            options={[
                                t("register:Gender.male"),
                                t("register:Gender.female"),
                                t("register:Gender.other")
                            ]}
                        />
                        <View style={registerStyles.termsContainer}>

                            {/* Checkbox */}
                            <TouchableOpacity
                                style={[
                                    registerStyles.checkbox,
                                    acceptedTerms && registerStyles.checkboxActive
                                ]}
                                onPress={() => setAcceptedTerms(!acceptedTerms)}
                                activeOpacity={0.8}
                            >
                                {acceptedTerms && (
                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity>
                                <Text style={registerStyles.termsText}>
                                    {t("termsAndConditions")}
                                </Text>
                            </TouchableOpacity>

                        </View>
                        <View style={registerStyles.buttonSection}>
                            <TouchableOpacity
                                style={[commonStyles.primaryButton, loading && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={commonStyles.primaryButtonText}>{t('common:buttons.save')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={registerStyles.divider}>
                            <View style={registerStyles.dividerLine} />
                            <Text style={registerStyles.dividerText}>{t('login:or')}</Text>
                            <View style={registerStyles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={registerStyles.registerButton}
                            onPress={() => navigation.navigate('LoginScreen')}
                            activeOpacity={0.8}
                        >
                            <Text style={registerStyles.registerText}>
                                {t('register:account')}{' '}
                                <Text style={registerStyles.registerLink}>
                                    {t('register:loginNow')}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>

    )
}


export default Register
