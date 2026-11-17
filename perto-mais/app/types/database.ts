
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"business_hours": {
                  Row: {
                    "business_id": string,"closes_at": string,"created_at": string,"id": string,"opens_at": string,"updated_at": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"closes_at": string,"created_at"?: string,"id"?: string,"opens_at": string,"updated_at"?: string,"weekday": number
                  }
                  Update: {
                    "business_id"?: string,"closes_at"?: string,"created_at"?: string,"id"?: string,"opens_at"?: string,"updated_at"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_hours_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_hours_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_metrics": {
                  Row: {
                    "business_id": string,"created_at": string,"day": string,"id": string,"page_views": number,"phone_clicks": number,"product_views": number,"updated_at": string,"whatsapp_clicks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"day": string,"id"?: string,"page_views"?: number,"phone_clicks"?: number,"product_views"?: number,"updated_at"?: string,"whatsapp_clicks"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"day"?: string,"id"?: string,"page_views"?: number,"phone_clicks"?: number,"product_views"?: number,"updated_at"?: string,"whatsapp_clicks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_metrics_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_metrics_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_photos": {
                  Row: {
                    "business_id": string,"caption": string | null,"created_at": string,"id": string,"path": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"caption"?: string | null,"created_at"?: string,"id"?: string,"path": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"caption"?: string | null,"created_at"?: string,"id"?: string,"path"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_photos_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_photos_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address_complement": string | null,"address_line": string,"approved_at": string | null,"category_id": string,"city_id": string,"cover_path": string | null,"created_at": string,"description": string | null,"id": string,"instagram": string | null,"is_demo": boolean,"keywords": (string)[],"latitude": number | null,"logo_path": string | null,"longitude": number | null,"name": string,"neighborhood_id": string,"owner_id": string,"phone_e164": string | null,"postal_code": string | null,"search_vector": unknown,"slug": string,"status": Database["public"]['Enums']["business_status"],"status_reason": string | null,"updated_at": string,"whatsapp_e164": string | null,"business_search_vector": unknown
                  }
                  ComputedFields: "business_search_vector"
                  Insert: {
                    "address_complement"?: string | null,"address_line": string,"approved_at"?: string | null,"category_id": string,"city_id": string,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"instagram"?: string | null,"is_demo"?: boolean,"keywords"?: (string)[],"latitude"?: number | null,"logo_path"?: string | null,"longitude"?: number | null,"name": string,"neighborhood_id": string,"owner_id": string,"phone_e164"?: string | null,"postal_code"?: string | null,"search_vector"?: unknown,"slug"?: string,"status"?: Database["public"]['Enums']["business_status"],"status_reason"?: string | null,"updated_at"?: string,"whatsapp_e164"?: string | null
                  }
                  Update: {
                    "address_complement"?: string | null,"address_line"?: string,"approved_at"?: string | null,"category_id"?: string,"city_id"?: string,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"instagram"?: string | null,"is_demo"?: boolean,"keywords"?: (string)[],"latitude"?: number | null,"logo_path"?: string | null,"longitude"?: number | null,"name"?: string,"neighborhood_id"?: string,"owner_id"?: string,"phone_e164"?: string | null,"postal_code"?: string | null,"search_vector"?: unknown,"slug"?: string,"status"?: Database["public"]['Enums']["business_status"],"status_reason"?: string | null,"updated_at"?: string,"whatsapp_e164"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["parent_category_id"]
    },{
      foreignKeyName: "businesses_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_neighborhood_id_fkey"
      columns: ["neighborhood_id"]
isOneToOne: false
      referencedRelation: "neighborhoods"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"icon": string,"id": string,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number,"updated_at": string,"uses_menu_layout": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string,"uses_menu_layout"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string,"uses_menu_layout"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["parent_category_id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"latitude": number | null,"longitude": number | null,"name": string,"slug": string,"sort_order": number,"state_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name": string,"slug"?: string,"sort_order"?: number,"state_id": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"slug"?: string,"sort_order"?: number,"state_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cities_state_id_fkey"
      columns: ["state_id"]
isOneToOne: false
      referencedRelation: "states"
      referencedColumns: ["id"]
    }
                  ]
                },"featured_businesses": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_businesses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_businesses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"metric_events": {
                  Row: {
                    "business_id": string,"created_at": string,"day": string,"event_type": Database["public"]['Enums']["metric_event_type"],"id": string,"product_id": string | null,"session_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"day": string,"event_type": Database["public"]['Enums']["metric_event_type"],"id"?: string,"product_id"?: string | null,"session_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"day"?: string,"event_type"?: Database["public"]['Enums']["metric_event_type"],"id"?: string,"product_id"?: string | null,"session_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "metric_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "metric_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "metric_events_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"neighborhoods": {
                  Row: {
                    "city_id": string,"created_at": string,"id": string,"is_active": boolean,"latitude": number | null,"longitude": number | null,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name": string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "city_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "neighborhoods_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "billing_interval": Database["public"]['Enums']["billing_interval"],"can_cover": boolean,"can_description": boolean,"can_detailed_stats": boolean,"can_gallery": boolean,"can_instagram": boolean,"can_logo": boolean,"can_products": boolean,"code": string,"created_at": string,"description": string | null,"features": (string)[],"highlight_in_listing": boolean,"id": string,"is_active": boolean,"is_default": boolean,"is_public": boolean,"max_photos": number,"max_products": number,"name": string,"price_cents": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval"?: Database["public"]['Enums']["billing_interval"],"can_cover"?: boolean,"can_description"?: boolean,"can_detailed_stats"?: boolean,"can_gallery"?: boolean,"can_instagram"?: boolean,"can_logo"?: boolean,"can_products"?: boolean,"code": string,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"highlight_in_listing"?: boolean,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"is_public"?: boolean,"max_photos"?: number,"max_products"?: number,"name": string,"price_cents"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "billing_interval"?: Database["public"]['Enums']["billing_interval"],"can_cover"?: boolean,"can_description"?: boolean,"can_detailed_stats"?: boolean,"can_gallery"?: boolean,"can_instagram"?: boolean,"can_logo"?: boolean,"can_products"?: boolean,"code"?: string,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"highlight_in_listing"?: boolean,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"is_public"?: boolean,"max_photos"?: number,"max_products"?: number,"name"?: string,"price_cents"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_categories": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "business_id": string,"created_at": string,"description": string | null,"id": string,"is_available": boolean,"is_featured": boolean,"name": string,"photo_path": string | null,"price_cents": number | null,"product_category_id": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_available"?: boolean,"is_featured"?: boolean,"name": string,"photo_path"?: string | null,"price_cents"?: number | null,"product_category_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_available"?: boolean,"is_featured"?: boolean,"name"?: string,"photo_path"?: string | null,"price_cents"?: number | null,"product_category_id"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_product_category_id_fkey"
      columns: ["product_category_id"]
isOneToOne: false
      referencedRelation: "product_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"phone_e164": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"phone_e164"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "created_at": string,"hits": number,"id": string,"key": string,"updated_at": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hits"?: number,"id"?: string,"key": string,"updated_at"?: string,"window_start": string
                  }
                  Update: {
                    "created_at"?: string,"hits"?: number,"id"?: string,"key"?: string,"updated_at"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reserved_slugs": {
                  Row: {
                    "created_at": string,"id": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"states": {
                  Row: {
                    "country_code": string,"created_at": string,"id": string,"name": string,"slug": string,"uf": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code"?: string,"created_at"?: string,"id"?: string,"name": string,"slug"?: string,"uf": string,"updated_at"?: string
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"uf"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "activated_at": string | null,"activated_by": string | null,"business_id": string,"canceled_at": string | null,"created_at": string,"discount_cents": number,"ends_at": string | null,"id": string,"notes": string | null,"plan_id": string,"price_cents": number,"provider": string,"provider_ref": string | null,"requested_by": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["subscription_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"business_id": string,"canceled_at"?: string | null,"created_at"?: string,"discount_cents"?: number,"ends_at"?: string | null,"id"?: string,"notes"?: string | null,"plan_id": string,"price_cents": number,"provider"?: string,"provider_ref"?: string | null,"requested_by"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"business_id"?: string,"canceled_at"?: string | null,"created_at"?: string,"discount_cents"?: number,"ends_at"?: string | null,"id"?: string,"notes"?: string | null,"plan_id"?: string,"price_cents"?: number,"provider"?: string,"provider_ref"?: string | null,"requested_by"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_businesses": {
                  Row: {
                    "address_complement": string | null,"address_line": string,"approved_at": string | null,"category_icon": string,"category_id": string,"category_name": string,"category_slug": string,"city_id": string,"city_name": string,"city_slug": string,"cover_path": string | null,"created_at": string,"description": string | null,"has_vitrine": boolean | null,"id": string,"instagram": string | null,"is_demo": boolean,"is_featured": boolean | null,"is_highlighted": boolean | null,"is_open_now": boolean | null,"latitude": number | null,"logo_path": string | null,"longitude": number | null,"name": string,"neighborhood_id": string,"neighborhood_name": string,"neighborhood_slug": string,"parent_category_id": string | null,"parent_category_name": string | null,"parent_category_slug": string | null,"phone_e164": string | null,"plan_code": string | null,"postal_code": string | null,"shows_gallery": boolean | null,"shows_products": boolean | null,"slug": string,"state_uf": string,"updated_at": string,"uses_menu_layout": boolean | null,"whatsapp_e164": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "businesses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "public_businesses"
      referencedColumns: ["parent_category_id"]
    },{
      foreignKeyName: "businesses_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "businesses_neighborhood_id_fkey"
      columns: ["neighborhood_id"]
isOneToOne: false
      referencedRelation: "neighborhoods"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_activate_subscription":
{ Args: { "p_ends_at": string,"p_notes"?: string,"p_starts_at": string,"p_subscription_id": string }; Returns: undefined
                           },
"admin_business_owner":
{ Args: { "p_business_id": string }; Returns: {
              "email": string,"email_confirmed_at": string,"full_name": string,"owner_id": string,"phone_e164": string
            }[]
                           },
"admin_cancel_subscription":
{ Args: { "p_notes"?: string,"p_subscription_id": string }; Returns: undefined
                           },
"admin_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_grant_subscription":
{ Args: { "p_business_id": string,"p_ends_at": string,"p_notes"?: string,"p_plan_code": string,"p_starts_at": string }; Returns: string
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "businesses_count": number,"created_at": string,"email": string,"email_confirmed_at": string,"full_name": string,"id": string,"last_sign_in_at": string,"phone_e164": string,"roles": (Database["public"]['Enums']["app_role"])[],"total_count": number
            }[]
                           },
"business_has":
{ Args: { "p_business_id": string,"p_feature": string }; Returns: boolean
                           },
"business_plan":
{ Args: { "p_business_id": string }; Returns: {
              "billing_interval": Database["public"]['Enums']["billing_interval"],
"can_cover": boolean,
"can_description": boolean,
"can_detailed_stats": boolean,
"can_gallery": boolean,
"can_instagram": boolean,
"can_logo": boolean,
"can_products": boolean,
"code": string,
"created_at": string,
"description": string | null,
"features": (string)[],
"highlight_in_listing": boolean,
"id": string,
"is_active": boolean,
"is_default": boolean,
"is_public": boolean,
"max_photos": number,
"max_products": number,
"name": string,
"price_cents": number,
"sort_order": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"business_search_vector":
{ Args: { "p_business": Omit<Database["public"]['Tables']["businesses"]['Row'], Database["public"]['Tables']["businesses"]['ComputedFields']> }; Returns: unknown
                           },
"business_stats":
{ Args: { "p_business_id": string,"p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"can_manage_business_folder":
{ Args: { "p_object_name": string }; Returns: boolean
                           },
"cancel_subscription_request":
{ Args: { "p_subscription_id": string }; Returns: undefined
                           },
"category_counts":
{ Args: { "p_city": string,"p_neighborhood"?: string }; Returns: {
              "category_id": string,"parent_id": string,"total": number
            }[]
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"distance_km":
{ Args: { "lat1": number,"lat2": number,"lng1": number,"lng2": number }; Returns: number
                           },
"email_confirmed":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"expire_subscriptions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"immutable_unaccent":
{ Args: { "value": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_open_at":
{ Args: { "p_at"?: string,"p_business_id": string }; Returns: boolean
                           },
"is_privileged":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_public_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"log_admin_action":
{ Args: { "p_action": string,"p_details"?: Json,"p_entity": string,"p_entity_id": string }; Returns: undefined
                           },
"owns_business":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"remove_demo_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"request_subscription":
{ Args: { "p_business_id": string,"p_plan_code": string }; Returns: string
                           },
"resubmit_business":
{ Args: { "p_business_id": string }; Returns: undefined
                           },
"search_businesses":
{ Args: { "p_category"?: string,"p_city"?: string,"p_featured"?: boolean,"p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_neighborhood"?: string,"p_offset"?: number,"p_open_now"?: boolean,"p_query"?: string,"p_sort"?: string,"p_vitrine"?: boolean }; Returns: {
              "distance_km": number,"id": string,"rank": number,"total_count": number
            }[]
                           },
"slugify":
{ Args: { "value": string }; Returns: string
                           },
"track_event":
{ Args: { "p_business_id": string,"p_event_type": Database["public"]['Enums']["metric_event_type"],"p_product_id"?: string,"p_session_hash": string,"p_viewer_id"?: string }; Returns: boolean
                           },
"unique_slug":
{ Args: { "p_exclude_id"?: string,"p_scope_column"?: string,"p_scope_value"?: string,"p_table": unknown,"p_value": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "admin"|"merchant","billing_interval": "none"|"month"|"year","business_status": "pending"|"approved"|"rejected"|"suspended","metric_event_type": "page_view"|"whatsapp_click"|"phone_click"|"product_view","subscription_status": "pending"|"active"|"canceled"|"expired"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "merchant"],"billing_interval": ["none", "month", "year"],"business_status": ["pending", "approved", "rejected", "suspended"],"metric_event_type": ["page_view", "whatsapp_click", "phone_click", "product_view"],"subscription_status": ["pending", "active", "canceled", "expired"]
          }
        }
} as const
