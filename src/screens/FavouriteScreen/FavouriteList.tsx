import React, { useEffect, useMemo } from 'react';
import { FlatList } from 'react-native';
import { commonStyles } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import { useFollowManager } from '../../hooks/useFollowManager';
import RaceCard from './RaceCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';

const FavouriteList = ({ t }: any) => {
    const {
        followedUsers,
        followedBibs,
        refreshFollowedUsers,
    } = useFollowManager(t);

    useEffect(() => {
        refreshFollowedUsers();
    }, []);

    const combinedList = useMemo(() => {
        const users = Array.from(followedUsers).map((id) => ({
            type: 'user',
            id,
        }));
        const bibs: any[] = [];
        followedBibs.forEach((bibSet, productId) => {
            bibSet.forEach((bib) => {
                bibs.push({
                    type: 'bib',
                    productId,
                    bib,
                });
            });
        });

        return [...users, ...bibs];
    }, [followedUsers, followedBibs]);

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <AppHeader title="Favourites" />

            <FlatList
                data={combinedList}
                keyExtractor={(item, index) =>
                    item.type === 'user'
                        ? `user-${item.id}`
                        : `bib-${item.productId}-${item.bib}-${index}`
                }
                renderItem={({ item }) => (
                    <RaceCard item={item} />
                )}
            />
            <BottomNavigationFollower />
        </SafeAreaView>
    );
};

export default FavouriteList;