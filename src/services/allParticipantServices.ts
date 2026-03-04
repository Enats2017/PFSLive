

export interface RaceResult {
  id: string;
  rank: number;
  name: string;
  bib: number;
  team: string;
  time: string;
  diff: string;
  rankingCategory: string;
  rankingPos: number;
  isLive: boolean;
  isFavorite: boolean;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FiltersState {
  distance: FilterOption;
  type: FilterOption;
  category: FilterOption;
}

export interface FilterOptionsResponse {
  distances: FilterOption[];
  types: FilterOption[];
  categories: FilterOption[];
}

const BASE_URL = 'https://your-api.com';

export const allParticipantServices = {

  /** Fetch filter options — called once on mount */
  getFilterOptions: async (): Promise<FilterOptionsResponse> => {
    // TODO: uncomment when API ready 👇
    // const res = await fetch(`${BASE_URL}/filters`);
    // if (!res.ok) throw new Error(`Error ${res.status}`);
    // return res.json();

    // ── MOCK (delete when API ready) ──────────────────────────────────────
    return {
      distances: [
        { label: '100 km', value: '100' },
        { label: '50 km',  value: '50'  },
        { label: '25 km',  value: '25'  },
        { label: '10 km',  value: '10'  },
      ],
      types: [
        { label: 'Results',    value: 'results'    },
        { label: 'Live',     value: 'live'     },
        { label: 'Favourite', value: 'categories' },
      ],
      categories: [
        { label: 'Scratch', value: 'scratch' },
        { label: 'SE H',    value: 'se_h'    },
        { label: 'SE F',    value: 'se_f'    },
        { label: 'M0 H',    value: 'm0_h'    },
        { label: 'M0 F',    value: 'm0_f'    },
        { label: 'M1 H',    value: 'm1_h'    },
        { label: 'M1 F',    value: 'm1_f'    },
      ],
    };
    // ── END MOCK ──────────────────────────────────────────────────────────
  },

  /** Fetch results based on active filters — called on every filter change */
  getResults: async (filters: FiltersState): Promise<RaceResult[]> => {
    // TODO: uncomment when API ready 👇
    // const params = new URLSearchParams({
    //   distance: filters.distance.value,
    //   type:     filters.type.value,
    //   category: filters.category.value,
    // });
    // const res = await fetch(`${BASE_URL}/results?${params}`);
    // if (!res.ok) throw new Error(`Error ${res.status}`);
    // return res.json();

    // ── MOCK (delete when API ready) ──────────────────────────────────────
    return [
      {
        id: '1', rank: 1,
        name: 'Jérémy ARBORE', bib: 3,
        team: 'Les Contamines Montjoie / Nitecore',
        time: '10:51:48', diff: '00:00:00',
        rankingCategory: 'SE H', rankingPos: 1,
        isLive: true, isFavorite: false,
      },
      {
        id: '2', rank: 2,
        name: 'Benoit RIBEIRO', bib: 5,
        team: "L'homme en rouge",
        time: '11:06:41', diff: '00:14:53',
        rankingCategory: 'M0 H', rankingPos: 1,
        isLive: false, isFavorite: false,
      },
      {
        id: '3', rank: 3,
        name: 'Lucas MARTIN', bib: 12,
        team: 'Trail Club Grenoble',
        time: '11:22:10', diff: '00:30:22',
        rankingCategory: 'SE H', rankingPos: 2,
        isLive: false, isFavorite: false,
      },
      {
        id: '4', rank: 4,
        name: 'Sophie DURAND', bib: 8,
        team: 'Chamonix Runners',
        time: '11:45:33', diff: '00:53:45',
        rankingCategory: 'SE F', rankingPos: 1,
        isLive: false, isFavorite: false,
      },
      {
        id: '5', rank: 5,
        name: 'Antoine LEMAIRE', bib: 21,
        team: 'Lyon Trail',
        time: '12:01:17', diff: '01:09:29',
        rankingCategory: 'M1 H', rankingPos: 1,
        isLive: false, isFavorite: false,
      },
    ];
    // ── END MOCK ──────────────────────────────────────────────────────────
  },

  /** Toggle favorite — called when user taps star */
  toggleFavorite: async (id: string, isFavorite: boolean): Promise<void> => {
    // TODO: uncomment when API ready 👇
    // await fetch(`${BASE_URL}/results/${id}/favorite`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ isFavorite }),
    // });
    console.log(`[API] toggleFavorite id=${id} isFavorite=${isFavorite}`);
  },
};