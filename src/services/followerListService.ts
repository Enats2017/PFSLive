// userFollowersService.ts

import { apiClient } from "./api";
import { API_CONFIG, getApiEndpoint } from "../constants/config";

export interface FollowerItem {
    customer_app_id: number;
    firstname: string;
    lastname: string;
    email: string;
    city: string;
    country: string;
    profile_picture?: string;
    flag_url?: string | null;
    password_protected: 0 | 1;
}

export interface FollowerPagination {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}

export interface FollowersResponse {
    followers: FollowerItem[];
    pagination: FollowerPagination;
}

export interface GetFollowersParams {
    search?: string;
    page?: number;
}

interface FollowersData {
    followers?: FollowerItem[];
    pagination?: FollowerPagination;
}

export const userFollowersService = {
    async getFollowers(
        params: GetFollowersParams = {},
    ): Promise<FollowersResponse> {
        try {
            if (API_CONFIG.DEBUG) {
                console.log("📡 Fetching followers:", { params });
            }

            const url = getApiEndpoint(API_CONFIG.ENDPOINTS.GET_MY_FOLLOWERS); // 👈 add this endpoint
            const headers = await API_CONFIG.getHeaders();

            const requestBody = {
                search: params.search ?? "",
                page: params.page ?? 1,
            };

            const response = await apiClient.post<FollowersData>(url, requestBody, {
                headers,
            });

            if (response.success && response.data) {
                if (API_CONFIG.DEBUG) {
                    console.log("✅ Followers loaded:", {
                        total: response.data.pagination?.total ?? 0,
                        page: response.data.pagination?.page ?? 1,
                    });
                }

                return {
                    followers: response.data.followers ?? [],
                    pagination: response.data.pagination ?? {
                        page: 1,
                        per_page: 0,
                        total: 0,
                        total_pages: 1,
                    },
                };
            }

            throw new Error(response.error || "Failed to fetch followers");
        } catch (error: any) {
            if (API_CONFIG.DEBUG) {
                console.error("❌ Error fetching followers:", error.message);
            }
            throw error;
        }
    },
};