export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          pool_fee_type: string
          pool_fee_value: number
          updated_at: string
        }
        Insert: {
          id?: number
          pool_fee_type?: string
          pool_fee_value?: number
          updated_at?: string
        }
        Update: {
          id?: number
          pool_fee_type?: string
          pool_fee_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          resolved: boolean
          ride_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          resolved?: boolean
          ride_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          resolved?: boolean
          ride_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          doc_type: string
          driver_id: string
          file_path: string
          id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          doc_type: string
          driver_id: string
          file_path: string
          id?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          doc_type?: string
          driver_id?: string
          file_path?: string
          id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      drivers: {
        Row: {
          admin_note: string | null
          city: string
          cnic: string
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          home_address: string | null
          licence_category: string | null
          licence_expiry: string | null
          licence_no: string
          online: boolean
          phone: string
          rating: number
          reviewed_at: string | null
          status: Database["public"]["Enums"]["driver_status"]
          submitted_at: string | null
          terms_accepted_at: string | null
          user_id: string
          working_hours: string | null
        }
        Insert: {
          admin_note?: string | null
          city: string
          cnic: string
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          home_address?: string | null
          licence_category?: string | null
          licence_expiry?: string | null
          licence_no: string
          online?: boolean
          phone: string
          rating?: number
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          terms_accepted_at?: string | null
          user_id: string
          working_hours?: string | null
        }
        Update: {
          admin_note?: string | null
          city?: string
          cnic?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          home_address?: string | null
          licence_category?: string | null
          licence_expiry?: string | null
          licence_no?: string
          online?: boolean
          phone?: string
          rating?: number
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          terms_accepted_at?: string | null
          user_id?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      fare_settings: {
        Row: {
          base_fare: number
          min_fare: number
          per_km: number
          per_min: number
          updated_at: string
          vehicle: Database["public"]["Enums"]["vehicle_kind"]
        }
        Insert: {
          base_fare: number
          min_fare?: number
          per_km: number
          per_min?: number
          updated_at?: string
          vehicle: Database["public"]["Enums"]["vehicle_kind"]
        }
        Update: {
          base_fare?: number
          min_fare?: number
          per_km?: number
          per_min?: number
          updated_at?: string
          vehicle?: Database["public"]["Enums"]["vehicle_kind"]
        }
        Relationships: []
      }
      pool_ratings: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string | null
          id: string
          pool_seat_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          pool_seat_id: string
          rater_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          pool_seat_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_ratings_pool_seat_id_fkey"
            columns: ["pool_seat_id"]
            isOneToOne: true
            referencedRelation: "pool_seat_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_routes: {
        Row: {
          available_seats: number
          created_at: string
          departure_date: string
          departure_time: string
          dest_lat: number | null
          dest_lng: number | null
          destination: string
          distance_km: number | null
          driver_first_name: string
          driver_id: string
          driver_rating: number
          duration_min: number | null
          flexible_minutes: number
          id: string
          max_route_deviation: number
          notes: string | null
          price_per_seat: number
          route_polyline: string | null
          start_city: string | null
          start_lat: number | null
          start_lng: number | null
          start_location: string
          status: Database["public"]["Enums"]["pool_route_status"]
          total_seats: number
          updated_at: string
          vehicle_id: string | null
          vehicle_kind: Database["public"]["Enums"]["vehicle_kind"]
          vehicle_label: string
        }
        Insert: {
          available_seats?: number
          created_at?: string
          departure_date: string
          departure_time: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination: string
          distance_km?: number | null
          driver_first_name: string
          driver_id: string
          driver_rating?: number
          duration_min?: number | null
          flexible_minutes?: number
          id?: string
          max_route_deviation?: number
          notes?: string | null
          price_per_seat: number
          route_polyline?: string | null
          start_city?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_location: string
          status?: Database["public"]["Enums"]["pool_route_status"]
          total_seats: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_kind: Database["public"]["Enums"]["vehicle_kind"]
          vehicle_label?: string
        }
        Update: {
          available_seats?: number
          created_at?: string
          departure_date?: string
          departure_time?: string
          dest_lat?: number | null
          dest_lng?: number | null
          destination?: string
          distance_km?: number | null
          driver_first_name?: string
          driver_id?: string
          driver_rating?: number
          duration_min?: number | null
          flexible_minutes?: number
          id?: string
          max_route_deviation?: number
          notes?: string | null
          price_per_seat?: number
          route_polyline?: string | null
          start_city?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string
          status?: Database["public"]["Enums"]["pool_route_status"]
          total_seats?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_kind?: Database["public"]["Enums"]["vehicle_kind"]
          vehicle_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pool_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_seat_requests: {
        Row: {
          created_at: string
          deviation_km: number
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_location: string
          emergency_contact: string
          fare: number
          id: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          pool_route_id: string
          request_status: Database["public"]["Enums"]["pool_request_status"]
          rider_first_name: string
          rider_id: string
          seats_requested: number
          trip_pin: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deviation_km?: number
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location: string
          emergency_contact: string
          fare?: number
          id?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          pool_route_id: string
          request_status?: Database["public"]["Enums"]["pool_request_status"]
          rider_first_name: string
          rider_id: string
          seats_requested?: number
          trip_pin?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deviation_km?: number
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_location?: string
          emergency_contact?: string
          fare?: number
          id?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          pool_route_id?: string
          request_status?: Database["public"]["Enums"]["pool_request_status"]
          rider_first_name?: string
          rider_id?: string
          seats_requested?: number
          trip_pin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_seat_requests_pool_route_id_fkey"
            columns: ["pool_route_id"]
            isOneToOne: false
            referencedRelation: "pool_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          full_name: string
          id: string
          location_sharing: boolean
          phone: string | null
          suspended: boolean
        }
        Insert: {
          city?: string | null
          created_at?: string
          full_name?: string
          id: string
          location_sharing?: boolean
          phone?: string | null
          suspended?: boolean
        }
        Update: {
          city?: string | null
          created_at?: string
          full_name?: string
          id?: string
          location_sharing?: boolean
          phone?: string | null
          suspended?: boolean
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string | null
          id: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          rater_id: string
          ride_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          rater_id?: string
          ride_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          booking_code: string
          created_at: string
          dest_lat: number | null
          dest_lng: number | null
          dest_place_id: string | null
          destination: string
          distance_km: number | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          driver_vehicle: string | null
          duration_min: number | null
          emergency_contact: string
          fare: number
          id: string
          pickup: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_place_id: string | null
          ride_date: string
          ride_time: string
          rider_id: string
          rider_name: string
          rider_phone: string
          route_polyline: string | null
          status: Database["public"]["Enums"]["ride_status"]
          trip_pin: string
          updated_at: string
          vehicle: Database["public"]["Enums"]["vehicle_kind"]
        }
        Insert: {
          booking_code?: string
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          dest_place_id?: string | null
          destination: string
          distance_km?: number | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_vehicle?: string | null
          duration_min?: number | null
          emergency_contact: string
          fare: number
          id?: string
          pickup: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          ride_date: string
          ride_time: string
          rider_id: string
          rider_name: string
          rider_phone: string
          route_polyline?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          trip_pin?: string
          updated_at?: string
          vehicle: Database["public"]["Enums"]["vehicle_kind"]
        }
        Update: {
          booking_code?: string
          created_at?: string
          dest_lat?: number | null
          dest_lng?: number | null
          dest_place_id?: string | null
          destination?: string
          distance_km?: number | null
          driver_id?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          driver_vehicle?: string | null
          duration_min?: number | null
          emergency_contact?: string
          fare?: number
          id?: string
          pickup?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          ride_date?: string
          ride_time?: string
          rider_id?: string
          rider_name?: string
          rider_phone?: string
          route_polyline?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          trip_pin?: string
          updated_at?: string
          vehicle?: Database["public"]["Enums"]["vehicle_kind"]
        }
        Relationships: []
      }
      riders: {
        Row: {
          created_at: string
          default_city: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_city?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_city?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          driver_id: string
          id: string
          kind: Database["public"]["Enums"]["vehicle_kind"]
          make: string | null
          make_model: string
          model: string | null
          model_year: number | null
          reg_no: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          driver_id: string
          id?: string
          kind: Database["public"]["Enums"]["vehicle_kind"]
          make?: string | null
          make_model: string
          model?: string | null
          model_year?: number | null
          reg_no: string
        }
        Update: {
          color?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["vehicle_kind"]
          make?: string | null
          make_model?: string
          model?: string | null
          model_year?: number | null
          reg_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_share_location: { Args: { _user: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pool_driver: {
        Args: { _route: string; _user: string }
        Returns: boolean
      }
      nearby_drivers: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          lat: number
          lng: number
          vehicle: Database["public"]["Enums"]["vehicle_kind"]
        }[]
      }
      rider_can_track: {
        Args: { _driver: string; _rider: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "rider"
      driver_status:
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
        | "incomplete"
        | "info_requested"
      pool_request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "completed"
      pool_route_status:
        | "open"
        | "almost_full"
        | "full"
        | "started"
        | "completed"
        | "cancelled"
        | "suspended"
      ride_status:
        | "requested"
        | "driver_assigned"
        | "driver_arriving"
        | "ride_started"
        | "completed"
        | "cancelled"
      vehicle_kind: "car" | "scooty" | "bike"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "driver", "rider"],
      driver_status: [
        "pending",
        "approved",
        "rejected",
        "suspended",
        "incomplete",
        "info_requested",
      ],
      pool_request_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "completed",
      ],
      pool_route_status: [
        "open",
        "almost_full",
        "full",
        "started",
        "completed",
        "cancelled",
        "suspended",
      ],
      ride_status: [
        "requested",
        "driver_assigned",
        "driver_arriving",
        "ride_started",
        "completed",
        "cancelled",
      ],
      vehicle_kind: ["car", "scooty", "bike"],
    },
  },
} as const
