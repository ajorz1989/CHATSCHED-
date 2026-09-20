import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { CATEGORIES, PROVINCES, PLATFORMS, PLACEMENT_TYPES, recommendedPlacementTypes, SA_CITIES_SUBURBS, CREATOR_APPROVAL_WINDOW_DAYS, BUSINESS_PAYMENT_WINDOW_DAYS, CREATOR_PAYOUT_WINDOW_HOURS, PLATFORM_COMMISSION_RATE, PUBLISHER_SHARE } from "../lib/constants";