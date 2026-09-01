// Types generated from API_TYPES.md

export interface ApiResponse<T> {
  success: boolean;
  data?: T | undefined;
  message?: string | undefined;
  error?: string | undefined;
  details?: string | undefined;
  count?: number | undefined;
  code?: string | undefined;
  updatedTables?: Record<string, TableEntity> | undefined;
}

export type BooleanFlag = boolean | 0 | 1;

export interface GuestEntity {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  attending: BooleanFlag;
  mealType: string;
  needsTransport: BooleanFlag;
  allergies: string | null;
  notes: string | null;
  tableId: number | null;
  isAdult: BooleanFlag;
  seatNumber: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuestCreateRequest {
  name: string;
  email?: string;
  phone?: string;
  adults?: number;
  children?: number;
  attendance?: boolean;
  mealType?: string;
  needsTransport?: boolean;
  allergies?: string;
  notes?: string;
  sendEmail?: boolean;
  isAdult?: boolean;
}

export interface GuestUpdateRequest {
  name: string;
  email?: string;
  phone?: string;
  attending?: boolean;
  mealType?: string;
  needsTransport?: boolean;
  allergies?: string;
  notes?: string;
  tableId?: number | null;
  seatNumber?: number | null;
}

export type GuestPatchRequest = Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  attending: boolean;
  mealType: string;
  needsTransport: boolean;
  allergies: string | null;
  notes: string | null;
  tableId: number | null;
  seatNumber: number | null;
}>;

export interface GuestFilters {
  attending?: boolean;
  needsTransport?: boolean;
  search?: string;
}

export interface ContactEntity {
  id: number;
  name: string;
  phone: string;
  side: string;
  countryCode: string;
  linkSent: 0 | 1;
  invitationStatus: string;
  sentAt?: string | null;
  respondedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactCreateRequest {
  name: string;
  phone: string;
  side: string;
  countryCode?: string;
}

export type ContactPatchRequest = Partial<{
  name: string;
  phone: string;
  side: string;
  countryCode: string;
  linkSent: boolean;
  sentAt: string | null;
  invitationStatus: string;
  respondedAt: string | null;
}>;

export interface ContactFilters {
  side?: string;
  linkSent?: boolean;
}

export interface FinanceEntity {
  id: number;
  description: string;
  amount: number;
  type: string;
  category?: string | null;
  date?: string | null;
  paidBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinanceCreateRequest {
  description: string;
  amount: number;
  type: string;
  category?: string;
  date?: string;
  paidBy?: string;
}

export interface FinanceUpdateRequest {
  description?: string;
  amount?: number;
  type?: string;
  category?: string | null;
  date?: string | null;
  paidBy?: string | null;
}

export interface TableEntity {
  id: number;
  name: string;
  capacity: number;
  shape: string;
  posX: number;
  posY: number;
  captainIds?: number[] | null;
  rotation?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TableCreateRequest {
  name?: string;
  capacity?: number;
  shape?: string;
  posX?: number;
  posY?: number;
}

export interface TableUpdateRequest {
  name?: string;
  capacity?: number;
  shape?: string;
  posX?: number;
  posY?: number;
  captainId?: number | null;
  captainIds?: number[] | null;
  rotation?: number;
}

export interface TodoEntity {
  id: number;
  name: string;
  status: string;
  date?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoCreateRequest {
  name: string;
  status?: string;
  date?: string;
}

export interface TodoUpdateRequest {
  name: string;
  status: string;
  date?: string | null;
}

export type TodoPatchRequest = Partial<{
  name: string;
  status: string;
  date: string | null;
}>;

export interface CategoryEntity {
  id: number;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryCreateRequest {
  name: string;
  slug: string;
}

export interface SettingItem {
  key: string;
  value: string | boolean | number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SettingUpdateRequest {
  value: string;
}

export interface MusicPlaylistSong {
  id: number;
  title: string;
  artist: string;
  youtube_url: string;
  youtube_id: string;
  note?: string | null;
  order_index: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MusicPlaylistCreateRequest {
  title: string;
  artist: string;
  youtube_url: string;
  youtube_id?: string;
  note?: string;
  order_index?: number;
}

export type MusicPlaylistPatchRequest = Partial<{
  title: string;
  artist: string;
  youtube_url: string;
  youtube_id: string;
  note: string | null;
  order_index: number;
}>;

export interface MusicPlaylistReorderRequest {
  songs: { id: number; order: number }[];
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthRegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  slug: string;
}

export interface AuthLoginResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface AuthRegisterResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface AiGenerateRequest {
  type:
    | 'absence_reason'
    | 'attendance_note'
    | 'attendance_full'
    | 'song_request'
    | 'invitation_text';
  guestName: string;
  songHint?: string;
  stream?: boolean;
}

export interface AiGenerateResponse {
  success: boolean;
  data?: {
    text: string;
  };
  error?: string;
}

export interface ConfirmationCodeQuery {
  code: string;
}
