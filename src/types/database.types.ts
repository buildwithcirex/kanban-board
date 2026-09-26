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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          actor_id: string | null
          board_id: string | null
          card_id: string | null
          created_at: string
          id: number
          payload: Json
          team_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          team_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          card_id: string
          created_at: string
          id: string
          mime: string
          name: string
          size: number
          storage_path: string
          updated_at: string
          uploader_id: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          mime: string
          name: string
          size: number
          storage_path: string
          updated_at?: string
          uploader_id?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          mime?: string
          name?: string
          size?: number
          storage_path?: string
          updated_at?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          archived: boolean
          background: string | null
          created_at: string
          created_by: string | null
          id: string
          position: string
          team_id: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["board_visibility"]
        }
        Insert: {
          archived?: boolean
          background?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          position: string
          team_id: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["board_visibility"]
        }
        Update: {
          archived?: boolean
          background?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          position?: string
          team_id?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["board_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      card_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          card_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          card_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          card_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignees_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_labels: {
        Row: {
          board_id: string
          card_id: string
          created_at: string
          label_id: string
        }
        Insert: {
          board_id: string
          card_id: string
          created_at?: string
          label_id: string
        }
        Update: {
          board_id?: string
          card_id?: string
          created_at?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_labels_card_fkey"
            columns: ["card_id", "board_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "board_id"]
          },
          {
            foreignKeyName: "card_labels_label_fkey"
            columns: ["label_id", "board_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id", "board_id"]
          },
        ]
      }
      cards: {
        Row: {
          archived: boolean
          board_id: string
          cover_color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_complete: boolean
          due_date: string | null
          id: string
          list_id: string
          position: string
          priority: Database["public"]["Enums"]["card_priority"]
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          board_id: string
          cover_color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_complete?: boolean
          due_date?: string | null
          id?: string
          list_id: string
          position: string
          priority?: Database["public"]["Enums"]["card_priority"]
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          board_id?: string
          cover_color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_complete?: boolean
          due_date?: string | null
          id?: string
          list_id?: string
          position?: string
          priority?: Database["public"]["Enums"]["card_priority"]
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_list_on_same_board_fkey"
            columns: ["list_id", "board_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id", "board_id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assignee_id: string | null
          checklist_id: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          position: string
          text: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          checklist_id: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          position: string
          text: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          checklist_id?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          position?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          card_id: string
          created_at: string
          id: string
          position: string
          title: string
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          position: string
          title: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          position?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          card_id: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          card_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          card_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          from_card_id: string
          id: string
          to_card_id: string
          type: Database["public"]["Enums"]["dependency_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_card_id: string
          id?: string
          to_card_id: string
          type?: Database["public"]["Enums"]["dependency_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_card_id?: string
          id?: string
          to_card_id?: string
          type?: Database["public"]["Enums"]["dependency_type"]
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_from_card_id_fkey"
            columns: ["from_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_to_card_id_fkey"
            columns: ["to_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: string
          name: string
          position: string
          updated_at: string
        }
        Insert: {
          board_id: string
          color: string
          created_at?: string
          id?: string
          name?: string
          position: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          archived: boolean
          board_id: string
          created_at: string
          id: string
          position: string
          title: string
          updated_at: string
          wip_limit: number | null
        }
        Insert: {
          archived?: boolean
          board_id: string
          created_at?: string
          id?: string
          position: string
          title: string
          updated_at?: string
          wip_limit?: number | null
        }
        Update: {
          archived?: boolean
          board_id?: string
          created_at?: string
          id?: string
          position?: string
          title?: string
          updated_at?: string
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lists_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          created_at: string
          in_app: boolean
          push: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          in_app?: boolean
          push?: boolean
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          in_app?: boolean
          push?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          board_id: string | null
          card_id: string | null
          created_at: string
          id: number
          payload: Json
          read_at: string | null
          team_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          read_at?: string | null
          team_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          id?: never
          payload?: Json
          read_at?: string | null
          team_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_team_member: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["team_role"]
          p_team_id: string
        }
        Returns: {
          created_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      board_id_from_storage_name: { Args: { p_name: string }; Returns: string }
      can_access_board: { Args: { p_board_id: string }; Returns: boolean }
      can_access_card: { Args: { p_card_id: string }; Returns: boolean }
      can_access_checklist: {
        Args: { p_checklist_id: string }
        Returns: boolean
      }
      can_assign_to_card: {
        Args: { p_card_id: string; p_user_id: string }
        Returns: boolean
      }
      can_edit_board: { Args: { p_board_id: string }; Returns: boolean }
      can_edit_card: { Args: { p_card_id: string }; Returns: boolean }
      can_edit_checklist: { Args: { p_checklist_id: string }; Returns: boolean }
      create_board: {
        Args: {
          p_background?: string
          p_position: string
          p_team_id: string
          p_title: string
          p_visibility?: Database["public"]["Enums"]["board_visibility"]
          p_with_default_lists?: boolean
        }
        Returns: {
          archived: boolean
          background: string | null
          created_at: string
          created_by: string | null
          id: string
          position: string
          team_id: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["board_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "boards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_team: {
        Args: { p_color?: string; p_description?: string; p_name: string }
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      default_profile_color: { Args: { p_id: string }; Returns: unknown }
      is_board_member: { Args: { p_board_id: string }; Returns: boolean }
      is_board_team_admin: { Args: { p_board_id: string }; Returns: boolean }
      is_board_team_member: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_admin: { Args: { p_team_id: string }; Returns: boolean }
      is_team_member: { Args: { p_team_id: string }; Returns: boolean }
      is_team_owner: { Args: { p_team_id: string }; Returns: boolean }
      remove_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
      set_board_visibility: {
        Args: {
          p_board_id: string
          p_visibility: Database["public"]["Enums"]["board_visibility"]
        }
        Returns: {
          archived: boolean
          background: string | null
          created_at: string
          created_by: string | null
          id: string
          position: string
          team_id: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["board_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "boards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_team_member_role: {
        Args: {
          p_role: Database["public"]["Enums"]["team_role"]
          p_team_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "team_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_team_with: { Args: { p_user_id: string }; Returns: boolean }
      team_role: {
        Args: { p_team_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
    }
    Enums: {
      board_visibility: "team" | "private"
      card_priority: "none" | "low" | "medium" | "high" | "urgent"
      dependency_type: "blocks" | "relates_to" | "duplicates"
      notification_type:
        | "card_assigned"
        | "card_unassigned"
        | "mention"
        | "comment"
        | "due_soon"
        | "overdue"
        | "added_to_team"
        | "added_to_board"
      team_role: "owner" | "admin" | "member"
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
      board_visibility: ["team", "private"],
      card_priority: ["none", "low", "medium", "high", "urgent"],
      dependency_type: ["blocks", "relates_to", "duplicates"],
      notification_type: [
        "card_assigned",
        "card_unassigned",
        "mention",
        "comment",
        "due_soon",
        "overdue",
        "added_to_team",
        "added_to_board",
      ],
      team_role: ["owner", "admin", "member"],
    },
  },
} as const
