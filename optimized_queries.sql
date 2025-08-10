-- Optimized Database Queries for Route System

-- get_all_routes

            SELECT 
                r.id,
                r.name,
                r.description,
                r.route_type,
                r.difficulty_level,
                r.estimated_duration,
                r.total_distance,
                r.elevation_gain,
                r.is_circular,
                r.season_availability,
                r.tags,
                r.created_at,
                r.updated_at,
                COUNT(DISTINCT rp.poi_id) as poi_count,
                COALESCE(
                    json_object_agg(
                        rr.category, rr.rating
                    ) FILTER (WHERE rr.category IS NOT NULL), 
                    '{}'::json
                ) as ratings
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE r.is_active = true
            GROUP BY r.id
            ORDER BY r.created_at DESC;
        

-- filter_routes

            SELECT 
                r.id,
                r.name,
                r.description,
                r.route_type,
                r.difficulty_level,
                r.estimated_duration,
                r.total_distance,
                r.is_circular,
                COUNT(DISTINCT rp.poi_id) as poi_count,
                COALESCE(
                    json_object_agg(
                        rr.category, rr.rating
                    ) FILTER (WHERE rr.category IS NOT NULL), 
                    '{}'::json
                ) as ratings
            FROM routes r
            LEFT JOIN route_pois rp ON r.id = rp.route_id
            LEFT JOIN route_ratings rr ON r.id = rr.route_id
            WHERE r.is_active = true
                AND ($1::text IS NULL OR r.route_type = $1)
                AND ($2::int IS NULL OR r.difficulty_level >= $2)
                AND ($3::int IS NULL OR r.difficulty_level <= $3)
                AND ($4::int IS NULL OR r.estimated_duration >= $4)
                AND ($5::int IS NULL OR r.estimated_duration <= $5)
                AND ($6::float IS NULL OR r.total_distance >= $6)
                AND ($7::float IS NULL OR r.total_distance <= $7)
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT $8 OFFSET $9;
        

-- get_route_details

            WITH route_data AS (
                SELECT 
                    r.*,
                    COALESCE(
                        json_object_agg(
                            rr.category, rr.rating
                        ) FILTER (WHERE rr.category IS NOT NULL), 
                        '{}'::json
                    ) as ratings
                FROM routes r
                LEFT JOIN route_ratings rr ON r.id = rr.route_id
                WHERE r.id = $1 AND r.is_active = true
                GROUP BY r.id
            ),
            route_pois AS (
                SELECT 
                    rp.route_id,
                    json_agg(
                        json_build_object(
                            'poi_id', rp.poi_id,
                            'order_in_route', rp.order_in_route,
                            'is_mandatory', rp.is_mandatory,
                            'estimated_time_at_poi', rp.estimated_time_at_poi,
                            'notes', rp.notes,
                            'name', p.name,
                            'lat', ST_Y(p.location::geometry),
                            'lon', ST_X(p.location::geometry),
                            'category', p.category,
                            'description', p.description
                        ) ORDER BY rp.order_in_route
                    ) as pois
                FROM route_pois rp
                JOIN pois p ON rp.poi_id = p.id
                WHERE rp.route_id = $1
                GROUP BY rp.route_id
            )
            SELECT 
                rd.*,
                COALESCE(rp.pois, '[]'::json) as pois
            FROM route_data rd
            LEFT JOIN route_pois rp ON rd.id = rp.route_id;
        

