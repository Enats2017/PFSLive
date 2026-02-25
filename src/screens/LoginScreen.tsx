import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/common/AppHeader';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { authService } from '../services/authService';
import { commonStyles } from '../styles/common.styles';
import { LoginScreenProps } from '../types/navigation';
import { toastSuccess } from '../../utils/toast';
import { loginStyles } from '../styles/login.styles';
import { homeStyles } from '../styles/home.styles';

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const { t } = useTranslation(['login', 'common']);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});
    const [loading, setLoading] = useState(false);

    const validate = (): boolean => {
        const newErrors: Record<string, string | undefined> = {};
        if (!email.trim() || !/\S+@\S+\.\S+/.test(email))
            newErrors.email = t('login:errors.emailInvalid');
        if (!password || password.length < 4)
            newErrors.password = t('login:errors.passwordShort');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const response = await authService.login(email.trim().toLowerCase(), password);
            if (response.success) {
                toastSuccess("Login SuccesFull")
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                });
            }
        } catch (error: any) {
            const data = error.response?.data;
            if (data?.error === 'invalid_credentials') {
                setErrors({ password: t('login:errors.invalidCredentials') });

            } else if (data?.error === 'account_not_found') {
                setErrors({ email: t('login:errors.accountNotFound') });

            } else if (data?.error === 'device_not_allowed') {
                Alert.alert(
                    t('login:alerts.deviceNotAllowed'),
                    t('login:alerts.deviceNotAllowedMessage')
                );

            } else if (error.request) {
                Alert.alert(
                    t('login:alerts.noConnection'),
                    t('login:alerts.noConnectionMessage')
                );

            } else {
                Alert.alert(
                    t('common:errors.generic'),
                    t('login:alerts.genericErrorMessage')
                );
            }

        } finally {
            setLoading(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────
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
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={loginStyles.inner}>
                        <View style={loginStyles.headerSection}>
                            <View style={loginStyles.cardscetion}>
                                <Image
                                    source={require("../../assets/Logo-img.png")}
                                    style={loginStyles.logo}
                                    resizeMode="contain"
                                />
                                <View style={loginStyles.textSection}>
                                    <Text style={commonStyles.title}>
                                        {t('common:app_name')}
                                    </Text>
                                </View>
                            </View>
                            <Text style={loginStyles.title}>{t('login:title')}</Text>
                            <Text style={loginStyles.subtitle}>{t('login:subtitle')}</Text>
                        </View>
                        <View style={loginStyles.formSection}>
                            <FloatingLabelInput
                                label={t('login:email')}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                                }}
                                iconName="mail-outline"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                required
                                error={errors.email}
                            />
                            <FloatingLabelInput
                                label={t('login:password')}
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                                }}
                                iconName="lock-closed-outline"
                                isPassword
                                required
                                error={errors.password}
                            />
                            <TouchableOpacity
                                style={loginStyles.forgotButton}
                                activeOpacity={0.7}
                                onPress={() => Alert.alert('Coming Soon', 'Forgot password feature coming soon.')}
                            >
                                <Text style={loginStyles.forgotText}>{t('login:forgotPassword')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[commonStyles.primaryButton, loading && { opacity: 0.7 }]}
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={commonStyles.primaryButtonText}>
                                        {t('login:loginButton')}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <View style={loginStyles.divider}>
                                <View style={loginStyles.dividerLine} />
                                <Text style={loginStyles.dividerText}>{t('login:or')}</Text>
                                <View style={loginStyles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={loginStyles.registerButton}
                                onPress={() => navigation.navigate('Register')}
                                activeOpacity={0.8}
                            >
                                <Text style={loginStyles.registerText}>
                                    {t('login:noAccount')}{' '}
                                    <Text style={loginStyles.registerLink}>
                                        {t('login:registerNow')}
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};



export default LoginScreen;
