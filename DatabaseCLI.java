import java.sql.*;
import java.util.Scanner;

public class DatabaseCLI {

    // great programming practice
    private static final String URL = "jdbc:postgresql://localhost:5432/postgres";
    private static final String USER = "demo_user";
    private static final String PASSWORD = "demo";

    // connect to the database using the url, user, and password
    public static Connection connect() {
        Connection conn = null;
        try {
            Class.forName("org.postgresql.Driver");
            conn = DriverManager.getConnection(URL, USER, PASSWORD);
        } catch (ClassNotFoundException e) {
            System.out.println(
                    "PostgreSQL JDBC Driver not found. Please ensure the postgresql-*.jar is in your classpath.");
            e.printStackTrace();
        } catch (SQLException e) {
            System.out.println(
                    "Connection failure. Check if the database 'postgres' exists and credentials are correct.");
            e.printStackTrace();
        }
        return conn;
    }

    // run sql query to get all cities
    public static void getAllCities(Connection conn) {
        String view_all_cities_query = "SELECT name, state FROM city";
        try (Statement statement = conn.createStatement()) {
            ResultSet rs = statement.executeQuery(view_all_cities_query);
            while (rs.next()) {
                String city_name = rs.getString("name");
                String city_state = rs.getString("state");
                System.out.println(city_name + ", " + city_state);
            }
        } catch (SQLException e) {
            System.out.print("City Viewing Failed.");
            e.printStackTrace();
        }
    }

    // function to get the industry stats for a specific city
    public static void getIndustryQuery(Connection conn, String city_name) {
        String specific_city_query = """
                        SELECT c.name, c.state, i.name as industryName, cis.median_salary, cis.num_job_openings, cis.growth_outlook_score
                        FROM cityindustrystats cis, city c, industry i
                        WHERE (cis.city_id = c.city_id) AND (cis.industry_id = i.industry_id) and (c.name = ?);
                """;
        try {
            PreparedStatement statement = conn.prepareStatement(specific_city_query);
            statement.setString(1, city_name);
            ResultSet rs = statement.executeQuery();
            // if no results returned, give error
            if (!rs.next()) {
                System.out.println("No such city: " + city_name + ". Make sure city names are capitalized!\n");
            } else {
                // if results returned, iterate over them
                do {
                    String cname = rs.getString("name");
                    String cstate = rs.getString("state");
                    String iname = rs.getString("industryName");
                    String median_salary = rs.getString("median_salary");
                    String num_job_openings = rs.getString("num_job_openings");
                    String growth_outlook_score = rs.getString("growth_outlook_score");
                    StringBuilder output = new StringBuilder();
                    output.append("\n******* ");
                    output.append(cname).append(", ");
                    output.append(cstate).append(", ");
                    output.append(iname);
                    output.append(" *******");
                    output.append("\nMedian Salary: ").append(median_salary);
                    output.append("\nNum Job Openings: ").append(num_job_openings);
                    output.append("\nGrowth Outlook Score: ").append(growth_outlook_score);
                    System.out.println(output.toString());
                } while (rs.next());
            }
        } catch (SQLException e) {
            System.out.print("Prepared Statement Construction Failed.\n");
            e.printStackTrace();
        }
    }

    // function to run sql query that gets the metrics for a given city
    public static void getMetricQuery(Connection conn, String city_name, char metric_option) {
        String specific_metric_query = """
                        SELECT c.name, c.state, m.name as metricName, cmv.value, cmv.year
                        FROM metric m, city c, citymetricvalue cmv
                        WHERE (cmv.city_id = c.city_id) AND (cmv.metric_id = m.metric_id) AND (c.name = ?)
                        AND (m.metric_id = ? OR m.metric_id = ?);
                """;
        try {
            PreparedStatement statement = conn.prepareStatement(specific_metric_query);
            statement.setString(1, city_name);
            if (metric_option == 'r') {
                // only pick rent metrics
                statement.setInt(2, 1);
                statement.setInt(3, 2);
            } else if (metric_option == 'm') {
                // pick misc metrics
                statement.setInt(2, 3);
                statement.setInt(3, 4);
            }
            ResultSet rs = statement.executeQuery();
            // if no results returned, give error
            if (!rs.next()) {
                System.out.println("No such city: " + city_name + ". Make sure city names are capitalized!\n");
            } else {
                // if results returned, iterate over them
                do {
                    String cname = rs.getString("name");
                    String cstate = rs.getString("state");
                    String mname = rs.getString("metricName");
                    Double value = rs.getDouble("value");
                    int year = rs.getInt("year");
                    StringBuilder output = new StringBuilder();
                    output.append("\n******* ");
                    output.append(cname).append(", ");
                    output.append(cstate).append(", ");
                    output.append(" *******");
                    output.append("\n");
                    output.append(year).append(", ");
                    output.append(mname);
                    output.append(": ").append(value);
                    System.out.println(output.toString());
                } while (rs.next());
            }
        } catch (SQLException e) {
            System.out.print("Prepared Statement Construction Failed.");
            e.printStackTrace();
        }
    }

    // get the ranking of all cities for a given metric
    public static void getRanking(Connection conn, char metric_option) {
        int metric_id = 0;
        Boolean first = true;
        try {
            metric_id = Integer.parseInt(metric_option + "");
            if (metric_id > 4) {
                throw new Exception("Invalid metric_id: " + metric_id);
            }
        } catch (Exception e) {
            System.out.print("Please Enter a Valid Option.");
            return;
        }
        String specific_ranking_query = """
                SELECT c.name, c.state, m.name as metric, cmv.value, rank()
                    OVER(order by cmv.value ASC) as rank
                FROM metric m, city c, citymetricvalue cmv
                WHERE (cmv.city_id = c.city_id) AND (cmv.metric_id = m.metric_id)
                AND (m.metric_id = ?)
                ORDER BY rank;
                """;
        try {
            PreparedStatement statement = conn.prepareStatement(specific_ranking_query);
            statement.setInt(1, metric_id);
            ResultSet rs = statement.executeQuery();
            // if no results returned, give error
            if (!rs.next()) {
                System.out.println("Error\n");
            } else {
                // if results returned, iterate over them
                do {
                    String cname = rs.getString("name");
                    String cstate = rs.getString("state");
                    String mname = rs.getString("metric");
                    Double value = rs.getDouble("value");
                    int rank = rs.getInt("rank");
                    StringBuilder output = new StringBuilder();
                    if (first) {
                        output.append("\n******* ");
                        output.append(mname).append(" Rankings");
                        output.append(" *******");
                        output.append("\n");
                        first = false;
                    }
                    output.append("[").append(rank).append("] ");
                    output.append(cname).append(", ");
                    output.append(cstate).append(", ").append(value);
                    System.out.println(output.toString());
                } while (rs.next());
            }
        } catch (SQLException e) {
            System.out.print("Prepared Statement Construction Failed.");
            e.printStackTrace();
        }
    }

    // print all users and their corresponding preferences
    public static void getUsers(Connection conn) {
        String view_all_cities_query = """
                SELECT first_name, last_name, profile_name, weight, m.name
                FROM app_user, preferenceprofile, preferenceweight, metric m
                WHERE app_user.user_id = preferenceprofile.user_id
                AND preferenceprofile.profile_id = preferenceweight.profile_id
                AND preferenceweight.metric_id = m.metric_id;
                """;
        String last_user_printed = "";
        try (Statement statement = conn.createStatement()) {
            ResultSet rs = statement.executeQuery(view_all_cities_query);
            while (rs.next()) {
                StringBuilder output = new StringBuilder();
                String first_name = rs.getString("first_name");
                String last_name = rs.getString("last_name");
                String profile_name = rs.getString("profile_name");
                Float weight = rs.getFloat("weight");
                String name = rs.getString("name");
                if (!(first_name + last_name).equals(last_user_printed)) {
                    last_user_printed = first_name + last_name;
                    output.append("\n******* ");
                    output.append(first_name).append(" ").append(last_name);
                    output.append(": ").append(profile_name).append(" profile");
                    output.append(" *******\n");
                }
                output.append(name).append(": ").append(weight);
                System.out.println(output.toString());
            }
        } catch (SQLException e) {
            System.out.print("User Viewing Failed.");
            e.printStackTrace();
        }
    }

    // get the top ranked city for a user given their preference profile
    public static void getUserRanking(Connection conn, String first_name, String last_name) {

        String get_user_preference_profile = """
                SELECT profile_id
                FROM app_user, preferenceprofile
                WHERE app_user.first_name = ?
                AND app_user.last_name = ?
                AND app_user.user_id = preferenceprofile.user_id;
                """;

        int preference_id = -1;

        try {
            PreparedStatement statement = conn.prepareStatement(get_user_preference_profile);
            statement.setString(1, first_name);
            statement.setString(2, last_name);
            ResultSet rs = statement.executeQuery();
            if (!rs.next()) {
                System.out.println("No such user with " + first_name + " " + last_name);
                return;
            }
            do {
                preference_id = rs.getInt("profile_id");
            } while (rs.next());
        } catch (SQLException e) {
            System.out.print("User Search Failed.");
            e.printStackTrace();
        }

        String view_all_cities_query = """
                with q as (
                    SELECT c.name, c.state, rank()
                        OVER(
                            PARTITION BY m.metric_id ORDER BY cmv.value
                        ) * pw.weight as weighted_rank
                    FROM metric m, city c, citymetricvalue cmv, preferenceweight pw
                    WHERE (cmv.city_id = c.city_id) AND (cmv.metric_id = m.metric_id)
                    AND (m.metric_id = pw.metric_id) AND (pw.profile_id = ?)
                )
                SELECT q.name, q.state, SUM(q.weighted_rank) as score
                FROM q
                GROUP BY q.name, q.state
                ORDER BY score;
                """;

        try (PreparedStatement statement = conn.prepareStatement(view_all_cities_query)) {
            statement.setInt(1, preference_id);
            ResultSet rs = statement.executeQuery();
            if (!rs.next()) {
                System.out.println("Error with city ranking query");
                return;
            }
            String city_name = rs.getString("name");
            String city_state = rs.getString("state");

            System.out.println(city_name + ", " + city_state);

        } catch (SQLException e) {
            System.out.print("City Rank Weighting Failed.");
            e.printStackTrace();
        }
    }

    // update the information of a given city
    public static void updateInformation(Connection conn, Scanner scanner) {
        System.out.println(
                "Would you like to update \n" +
                        "1 : Fair Market Rent (1-Bedroom)\n" +
                        "2 : Fair Market Rent (2-Bedroom)\n" +
                        "3 : Average Commute Time\n" +
                        "4 : Average Annual Temperature\n" +
                        "5 : Median Salary\n" +
                        "6 : Num Job Openings\n" +
                        "7 : Growth Outlook Score");
        char[] _update_choice;
        int update_choice;
        try {
            _update_choice = scanner.nextLine().toCharArray();
            update_choice = Integer.parseInt(_update_choice[0] + "");
        } catch (Exception e) {
            System.out.print("Please Enter a Valid Option.\n");
            return;
        }

        System.out.println("What city would you like to update?");

        String city_choice = scanner.nextLine();

        String get_city_id = """
                SELECT city_id FROM city WHERE name = ?;
                """;

        int city_id = -1;

        try {
            PreparedStatement statement = conn.prepareStatement(get_city_id);
            statement.setString(1, city_choice);
            ResultSet rs = statement.executeQuery();
            if (!rs.next()) {
                throw new SQLException();
            } else {
                city_id = rs.getInt("city_id");
            }
        } catch (SQLException e) {
            System.out.print("Cannot find city with name: " + city_choice + "\n");
            return;
        }

        if (update_choice <= 4 && update_choice >= 1) {
            String update_field = """
                    UPDATE citymetricvalue
                    SET value = ?
                    WHERE metric_id = ?
                    AND city_id = ?;
                    """;

            System.out.println(
                    "What would you like to update it to?");
            String _update_value = scanner.nextLine();
            double update_value = Double.parseDouble(_update_value);

            try {
                PreparedStatement statement = conn.prepareStatement(update_field);
                statement.setDouble(1, update_value);
                statement.setInt(2, update_choice);
                statement.setInt(3, city_id);
                int rows_updated = statement.executeUpdate();
                System.out.println("Rows updated: " + rows_updated);
            } catch (SQLException e) {
                System.out.print("\n");
            }

        } else if (update_choice >= 5 && update_choice <= 7) {
            System.out.println(
                    "Would you like to update \n" +
                            "1 : Software Engineering\n" +
                            "2 : Data Science / Analytics\n" +
                            "3 : Machine Learning / AI");
            char[] _industry_update_choice = scanner.nextLine().toCharArray();
            int industry_update_choice = Integer.parseInt(_industry_update_choice[0] + "");

            String industry_update_metric = "";
            if (update_choice == 5) {
                industry_update_metric = "median_salary";
            } else if (update_choice == 6) {
                industry_update_metric = "num_job_openings";
            } else {
                industry_update_metric = "growth_outlook_score";
            }

            System.out.println(
                    "What would you like to update it to?");
            String _industry_update_value = scanner.nextLine();
            int industry_update_value = Integer.parseInt(_industry_update_value);

            String update_field = """
                    UPDATE cityindustrystats
                    SET %s = ?
                    WHERE industry_id = ?
                    AND city_id = ?;
                    """.formatted(industry_update_metric);
            try {
                PreparedStatement statement = conn.prepareStatement(update_field);
                statement.setInt(1, industry_update_value);
                statement.setInt(2, industry_update_choice);
                statement.setInt(3, city_id);
                int rows_updated = statement.executeUpdate();
                System.out.println("Rows updated: " + rows_updated);
            } catch (SQLException e) {
                System.out.print("Error updating DB.\n");
                e.printStackTrace();
                return;
            }
        } else {
            System.out.print("Invalid update choice: " + update_choice + "\n");
            return;
        }
    }

    // insert a new city into the db
    public static void insertNewCity(Connection conn, Scanner scanner) {
        Savepoint savepoint = null;
        try {
            conn.setAutoCommit(false);
            savepoint = conn.setSavepoint("BeforeCityCreation");
        } catch (SQLException e) {
            e.printStackTrace();
            return;
        }

        // get city and state name
        System.out.println("Enter City Name: ");
        String city_name = scanner.nextLine();
        System.out.println("Enter City State [2 Char Code]: ");
        String city_state = scanner.nextLine().substring(0, 2);

        String create_new_city = """
                INSERT INTO city (name, state)
                VALUES (?, ?);
                """;
        try {
            PreparedStatement statement = conn.prepareStatement(create_new_city);
            statement.setString(1, city_name);
            statement.setString(2, city_state);
            int rows_created = statement.executeUpdate();
            System.out.println("Cities Created: " + rows_created);
        } catch (SQLException e) {
            System.out.print("Error With Creating New City\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        // get the id of the new city
        String get_city_id = """
                SELECT city_id FROM city WHERE name = ? AND state = ?;
                """;

        int city_id = -1;

        try {
            PreparedStatement statement = conn.prepareStatement(get_city_id);
            statement.setString(1, city_name);
            statement.setString(2, city_state);
            ResultSet rs = statement.executeQuery();
            if (!rs.next()) {
                throw new SQLException();
            } else {
                city_id = rs.getInt("city_id");
            }
        } catch (SQLException e) {
            System.out.print("Something very bad happened. Time to reset!\n");
            System.exit(1);
        }

        double fmr1b;
        double fmr2b;
        double act;
        double aat;
        try {
            System.out.println("Enter Fair Market Rent (1-Bedroom): ");
            fmr1b = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Fair Market Rent (2-Bedroom): ");
            fmr2b = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Average Commute Time: ");
            act = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Average Annual Temperature: ");
            aat = Double.parseDouble(scanner.nextLine());
        } catch (Exception e) {
            System.out.print("Couldn't parse input, make sure you enter double values.\n");
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        // add the city metrics for the new city
        String insert_into_city_metrics = """
                INSERT INTO CityMetricValue VALUES
                (?, 1, ?, 2025),
                (?, 2, ?, 2025),
                (?, 3, ?, 2025),
                (?, 4, ?, 2025)
                """;

        try {
            PreparedStatement statement = conn.prepareStatement(insert_into_city_metrics);
            // one bedroom
            statement.setInt(1, city_id);
            statement.setDouble(2, fmr1b);
            // two bedroom
            statement.setInt(3, city_id);
            statement.setDouble(4, fmr2b);
            // avg commute time
            statement.setInt(5, city_id);
            statement.setDouble(6, act);
            // avg annual temp
            statement.setInt(7, city_id);
            statement.setDouble(8, aat);
            int rows_created = statement.executeUpdate();
            System.out.println("Metrics Created: " + rows_created);
        } catch (SQLException e) {
            System.out.print("Error With Adding New Metrics\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        String insert_into_industry_metrics = """
                INSERT INTO CityIndustryStats (city_id, industry_id, median_salary, num_job_openings, growth_outlook_score) VALUES
                    (?, 1, ?, ?, ?),
                    (?, 2, ?, ?, ?),
                    (?, 3, ?, ?, ?)
                """;

        int swe[] = new int[3];
        int ds[] = new int[3];
        int ai[] = new int[3];

        try {
            System.out.println("Enter SWE Median Salary: ");
            swe[0] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter SWE Job Openings: ");
            swe[1] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter SWE Outlook Score: ");
            swe[2] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Data Science Median Salary: ");
            ds[0] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Data Science Job Openings: ");
            ds[1] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Data Science Outlook Score: ");
            ds[2] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Machine Learning Median Salary: ");
            ai[0] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Machine Learning Job Openings: ");
            ai[1] = Integer.parseInt(scanner.nextLine());
            System.out.println("Enter Machine Learning Outlook Score: ");
            ai[2] = Integer.parseInt(scanner.nextLine());

        } catch (Exception e) {
            System.out.print("Couldn't parse input, make sure you enter integer values.\n");
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        try {
            PreparedStatement statement = conn.prepareStatement(insert_into_industry_metrics);
            // SWE
            statement.setInt(1, city_id);
            statement.setInt(2, swe[0]);
            statement.setInt(3, swe[1]);
            statement.setInt(4, swe[2]);
            // DS
            statement.setInt(5, city_id);
            statement.setInt(6, ds[0]);
            statement.setInt(7, ds[1]);
            statement.setInt(8, ds[2]);
            // AI
            statement.setInt(9, city_id);
            statement.setInt(10, ai[0]);
            statement.setInt(11, ai[1]);
            statement.setInt(12, ai[2]);

            int rows_created = statement.executeUpdate();
            System.out.println("Industry Stats Created: " + rows_created);
            conn.commit();
        } catch (SQLException e) {
            System.out.print("Error With Adding New Metrics\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

    }

    // insert a new user into the db
    public static void insertNewUser(Connection conn, Scanner scanner) {
        Savepoint savepoint = null;
        try {
            conn.setAutoCommit(false);
            savepoint = conn.setSavepoint("BeforeUserCreation");
        } catch (SQLException e) {
            e.printStackTrace();
            return;
        }

        System.out.println("Enter User First Name: ");
        String first_name = scanner.nextLine();
        System.out.println("Enter User Last Name: ");
        String last_name = scanner.nextLine();

        int user_id = -1;

        String create_new_user = """
                INSERT INTO app_user (first_name, last_name)
                VALUES (?, ?)
                RETURNING user_id;
                """;
        try {
            PreparedStatement statement = conn.prepareStatement(create_new_user);
            statement.setString(1, first_name);
            statement.setString(2, last_name);
            ResultSet rs = statement.executeQuery();
            if (rs.next()) {
                user_id = rs.getInt("user_id");
            }

        } catch (SQLException e) {
            System.out.print("Error With Creating New User\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        // insert the user's weighted preferences
        double fmr1b;
        double fmr2b;
        double act;
        double aat;
        String profile_name;
        try {
            System.out.println("Enter Fair Market Rent (1-Bedroom) Weight: ");
            fmr1b = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Fair Market Rent (2-Bedroom) Weight: ");
            fmr2b = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Average Commute Time Weight: ");
            act = Double.parseDouble(scanner.nextLine());
            System.out.println("Enter Average Annual Temperature Weight: ");
            aat = Double.parseDouble(scanner.nextLine());
            System.out.println("What Would You Call Your Preference Profile? ");
            profile_name = scanner.nextLine();
        } catch (Exception e) {
            System.out.print("Couldn't parse input, make sure you enter double values for weights..\n");
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        String create_preference_profile = """
                INSERT INTO preferenceprofile (user_id, profile_name)
                VALUES (?, ?)
                RETURNING profile_id;
                """;

        int profile_id = -1;

        try {
            PreparedStatement statement = conn.prepareStatement(create_preference_profile);
            statement.setInt(1, user_id);
            statement.setString(2, profile_name);
            ResultSet rs = statement.executeQuery();
            if (rs.next()) {
                profile_id = rs.getInt("profile_id");
            }

        } catch (SQLException e) {
            System.out.print("Error With Creating New Preference Profile\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }

        String insert_into_preference_weights = """
                INSERT INTO preferenceweight VALUES
                (?, 1, ?),
                (?, 2, ?),
                (?, 3, ?),
                (?, 4, ?)
                """;

        try {
            PreparedStatement statement = conn.prepareStatement(insert_into_preference_weights);
            // one bedroom
            statement.setInt(1, profile_id);
            statement.setDouble(2, fmr1b);
            // two bedroom
            statement.setInt(3, profile_id);
            statement.setDouble(4, fmr2b);
            // avg commute time
            statement.setInt(5, profile_id);
            statement.setDouble(6, act);
            // avg annual temp
            statement.setInt(7, profile_id);
            statement.setDouble(8, aat);
            int rows_created = statement.executeUpdate();
            System.out.println("Metrics Created: " + rows_created);
        } catch (SQLException e) {
            System.out.print("Error With Adding New Metrics\n");
            e.printStackTrace();
            try {
                conn.rollback(savepoint);
            } catch (SQLException e2) {
                System.out.print("Error Rolling Back, you should probably reset\n");
                e2.printStackTrace();
                System.exit(1);
            }
            return;
        }
    }

    public static void main(String[] args) {
        Connection conn = connect();
        if (conn == null) {
            System.out.println("Could not establish database connection. Exiting...");
            return;
        }
        Scanner scanner = new Scanner(System.in);
        boolean loop = true;

        System.out.println("******* ENTER 'q' AT ANY TIME TO QUIT THE PROGRAM *******");

        while (loop) {
            System.out.println(
                    "Would you like to \n" +
                            "a : See List of All Cities\n" +
                            "s : Get Information About a Specific City\n" +
                            "r : Get City Rankings For a Metric\n" +
                            "u : Get User Information\n" +
                            "f : Update Information About a City\n" +
                            "n : Add New Information\n" +
                            "q : Exit the program\n");
            System.out.print("Enter choice: ");
            char[] choice = scanner.nextLine().toCharArray();
            // list all cities
            if (choice[0] == 'q') {
                loop = false;
            } else if (choice[0] == 'a') {
                getAllCities(conn);
            } else if (choice[0] == 's') {
                // choose what info to get about a city
                System.out.println(
                        "Would you like to \n" +
                                "i : Get Industry Statistics\n" +
                                "r : Get Rent Statistics\n" +
                                "m : Get Misc Statistics\n" +
                                "q : Exit the program\n");
                System.out.print("Enter choice: ");
                char[] second_choice = scanner.nextLine().toCharArray();
                System.out.print("Enter city name: ");
                String city = scanner.nextLine();
                if (city.length() == 1 && city.equals("q")) {
                    loop = false;
                    continue;
                }
                if (second_choice[0] == 'i') {
                    getIndustryQuery(conn, city);
                } else if (second_choice[0] == 'r') {
                    getMetricQuery(conn, city, 'r');
                } else if (second_choice[0] == 'm') {
                    getMetricQuery(conn, city, 'm');
                } else if (second_choice[0] == 'q') {
                    loop = false;
                } else {
                    System.out.print("Invalid choice. Please try again.\n");
                }
            } else if (choice[0] == 'r') {
                // choose what metric to rank the cities on
                System.out.println(
                        "Would you like to see the rankings for \n" +
                                "1 : Fair Market Rent (1-Bedroom)\n" +
                                "2 : Fair Market Rent (2-Bedroom)\n" +
                                "3 : Average Commute Time\n" +
                                "4 : Average Annual Temperature\n");
                char[] second_choice = scanner.nextLine().toCharArray();
                if (second_choice[0] == 'q') {
                    loop = false;
                } else {
                    getRanking(conn, second_choice[0]);
                }
            } else if (choice[0] == 'f') {
                // make sure autocommit is on
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException e) {
                    e.printStackTrace();
                    return;
                }

                updateInformation(conn, scanner);
            } else if (choice[0] == 'n') {
                System.out.println(
                        "Would you like to \n" +
                                "c : Add a New City\n" +
                                "u : Add a New User\n");
                System.out.print("Enter choice: ");
                char[] second_choice = scanner.nextLine().toCharArray();
                if (second_choice[0] == 'c') {
                    insertNewCity(conn, scanner);
                } else if (second_choice[0] == 'u') {
                    insertNewUser(conn, scanner);
                } else {
                    System.out.print("Invalid choice. Please try again.\n");
                }

                // make sure autocommit is turned back on
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException e) {
                    e.printStackTrace();
                    return;
                }
            } else if (choice[0] == 'u') {
                System.out.println(
                        "Would you like to \n" +
                                "u : See All Users\n" +
                                "r : See Top Ranked City For a User\n");
                System.out.print("Enter choice: ");
                char[] second_choice = scanner.nextLine().toCharArray();
                if (second_choice[0] == 'u') {
                    getUsers(conn);
                } else if (second_choice[0] == 'r') {
                    System.out.print(
                            "User first name: ");
                    String first_name = scanner.nextLine();
                    System.out.print(
                            "User last name: ");
                    String last_name = scanner.nextLine();
                    getUserRanking(conn, first_name, last_name);
                } else {
                    System.out.print("Invalid choice. Please try again.\n");
                }

            } else {
                System.out.print("Invalid choice");
            }
            System.out.print("\n");
        }
        System.exit(0);
    }
}