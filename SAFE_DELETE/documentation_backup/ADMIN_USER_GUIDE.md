# Admin User Guide - Predefined Routes System

## Table of Contents

1. [Getting Started](#getting-started)
2. [Accessing the Admin Panel](#accessing-the-admin-panel)
3. [Route Management](#route-management)
4. [POI Association](#poi-association)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Getting Started

The Predefined Routes System allows administrators to create, manage, and organize pre-defined routes for tourists. These routes complement the existing dynamic POI recommendation system.

### Key Features
- Create and manage predefined routes
- Associate POIs with routes in specific order
- Set route difficulty, duration, and type
- Add ratings for different categories
- Manage route visibility and status

## Accessing the Admin Panel

### 1. Login to the System
1. Navigate to the POI management system
2. Click on the login button or go to `/auth/login`
3. Enter your admin password
4. You will be redirected to the admin dashboard

### 2. Navigate to Route Management
1. From the admin dashboard, click on "POI Manager"
2. In the POI Manager interface, click on the "Rota Yönetimi" (Route Management) tab
3. You will see the route management interface

## Route Management

### Creating a New Route

1. **Access Route Creation**
   - Click the "➕ Yeni Rota" (New Route) button
   - The route creation form will appear

2. **Fill in Basic Information**
   - **Route Name**: Enter a descriptive name (e.g., "Kapadokya Yürüyüş Rotası")
   - **Description**: Provide a detailed description of the route
   - **Route Type**: Select from:
     - `walking` - Walking routes
     - `hiking` - Hiking routes  
     - `cycling` - Cycling routes
     - `driving` - Driving routes

3. **Set Route Parameters**
   - **Difficulty Level**: Choose from 1 (Easy) to 5 (Very Hard)
   - **Estimated Duration**: Enter duration in minutes
   - **Total Distance**: Enter distance in kilometers
   - **Elevation Gain**: Enter elevation gain in meters (optional)
   - **Is Circular**: Check if the route returns to starting point

4. **Configure Availability**
   - **Season Availability**: Select applicable seasons:
     - Spring (İlkbahar)
     - Summer (Yaz)
     - Autumn (Sonbahar)
     - Winter (Kış)
   - **Tags**: Add relevant tags separated by commas (e.g., "scenic, historical, family-friendly")

5. **Set Route Ratings**
   Rate the route in different categories (1-5 scale):
   - **Scenic Beauty** (Manzara Güzelliği)
   - **Historical Value** (Tarihi Değer)
   - **Cultural Significance** (Kültürel Önem)
   - **Family Friendly** (Aile Dostu)
   - **Photography** (Fotoğrafçılık)
   - **Adventure Level** (Macera Seviyesi)

6. **Save the Route**
   - Click "💾 Kaydet" (Save) to create the route
   - The system will validate your input and create the route
   - You'll see a success message if the route is created successfully

### Editing an Existing Route

1. **Find the Route**
   - In the route list, locate the route you want to edit
   - Click the "✏️ Düzenle" (Edit) button next to the route

2. **Modify Information**
   - The edit form will appear with current route information
   - Modify any fields as needed
   - All the same fields from route creation are available

3. **Save Changes**
   - Click "💾 Kaydet" (Save) to update the route
   - The system will update the route and refresh the list

### Deleting a Route

1. **Locate the Route**
   - Find the route in the route list
   - Click the "🗑️ Sil" (Delete) button

2. **Confirm Deletion**
   - A confirmation dialog will appear
   - Click "Evet" (Yes) to confirm deletion
   - The route will be marked as inactive (soft delete)

**Note**: Deleted routes are not permanently removed but marked as inactive. They won't appear in public listings but can be restored if needed.

## POI Association

### Adding POIs to a Route

1. **Access POI Management**
   - When creating or editing a route, scroll to the "POI Seçimi" (POI Selection) section
   - You'll see a list of available POIs

2. **Select POIs**
   - Browse through the available POIs
   - Click on POIs to add them to your route
   - Selected POIs will appear in the route POI list

3. **Configure POI Settings**
   For each selected POI, you can configure:
   - **Order in Route**: The sequence number (automatically assigned but can be modified)
   - **Is Mandatory**: Whether this POI is required or optional
   - **Estimated Time**: How long visitors should spend at this POI (in minutes)
   - **Notes**: Additional information or instructions for this POI

4. **Reorder POIs**
   - Use drag-and-drop to reorder POIs in the route
   - The order determines the sequence tourists will follow

5. **Remove POIs**
   - Click the "❌" button next to a POI to remove it from the route

### POI Selection Best Practices

1. **Logical Flow**
   - Arrange POIs in a logical geographical sequence
   - Consider travel time between POIs
   - Ensure the route makes sense for the chosen transportation type

2. **Balanced Experience**
   - Mix different types of POIs (historical, natural, cultural)
   - Consider visitor fatigue and rest points
   - Include facilities like restrooms, cafes, or parking when relevant

3. **Time Management**
   - Set realistic time estimates for each POI
   - Consider photography time, reading information, etc.
   - Account for travel time between POIs in total duration

## Best Practices

### Route Creation Guidelines

1. **Naming Convention**
   - Use descriptive, clear names
   - Include location and route type
   - Examples: "Ürgüp Merkez Yürüyüş Rotası", "Kapadokya Bisiklet Turu"

2. **Description Writing**
   - Write engaging, informative descriptions
   - Mention key highlights and attractions
   - Include practical information (difficulty, what to bring, etc.)
   - Use proper Turkish grammar and spelling

3. **Difficulty Assessment**
   - Level 1: Very easy, suitable for all ages and fitness levels
   - Level 2: Easy, minimal physical requirements
   - Level 3: Moderate, requires basic fitness
   - Level 4: Hard, requires good fitness and experience
   - Level 5: Very hard, for experienced and fit individuals only

4. **Duration Estimation**
   - Include time for POI visits, not just travel time
   - Add buffer time for photos, rest, and unexpected delays
   - Consider the target audience's pace

5. **Seasonal Considerations**
   - Mark routes unavailable in inappropriate seasons
   - Consider weather conditions, daylight hours
   - Note seasonal attractions or closures

### Quality Assurance

1. **Test Routes Personally**
   - Walk/drive the route yourself when possible
   - Verify POI locations and accessibility
   - Check estimated times and distances

2. **Regular Updates**
   - Review routes periodically for accuracy
   - Update information when POIs change
   - Remove or modify routes if conditions change

3. **User Feedback**
   - Monitor user feedback and ratings
   - Update routes based on visitor experiences
   - Address common issues or complaints

## Troubleshooting

### Common Issues and Solutions

#### Route Creation Fails
**Problem**: Error message when trying to create a route

**Solutions**:
1. Check that all required fields are filled
2. Ensure route name is unique
3. Verify duration and distance are positive numbers
4. Check that difficulty level is between 1-5
5. Refresh the page and try again

#### POIs Not Loading
**Problem**: POI list is empty or not displaying

**Solutions**:
1. Refresh the page
2. Check your internet connection
3. Verify you have admin permissions
4. Contact system administrator if problem persists

#### Route Not Appearing in Public List
**Problem**: Created route doesn't show up for tourists

**Solutions**:
1. Verify the route is marked as active
2. Check that at least one POI is associated
3. Ensure route has all required information
4. Wait a few minutes for cache to refresh

#### Permission Denied Errors
**Problem**: Cannot access admin functions

**Solutions**:
1. Verify you are logged in as an administrator
2. Check that your session hasn't expired
3. Log out and log back in
4. Contact system administrator for permission issues

### Getting Help

If you encounter issues not covered in this guide:

1. **Check System Logs**
   - Look for error messages in the browser console
   - Note any error codes or messages

2. **Contact Support**
   - Provide detailed description of the issue
   - Include steps to reproduce the problem
   - Share any error messages or screenshots

3. **System Status**
   - Check if other admin functions are working
   - Verify database connectivity
   - Ensure all required services are running

## Advanced Features

### Bulk Operations
- Use the statistics page to monitor route performance
- Export route data for analysis
- Import route data from external sources (contact administrator)

### Integration with POI System
- Routes automatically integrate with existing POI data
- Changes to POIs are reflected in associated routes
- Route recommendations can influence POI scoring

### Performance Monitoring
- Monitor route loading times
- Track user engagement with routes
- Analyze popular routes and optimize accordingly

## Security Notes

1. **Password Security**
   - Use strong, unique passwords
   - Change passwords regularly
   - Don't share admin credentials

2. **Data Protection**
   - Be careful when editing popular routes
   - Always test changes before publishing
   - Keep backups of important route configurations

3. **Access Control**
   - Log out when finished with admin tasks
   - Don't leave admin sessions open on shared computers
   - Report any suspicious activity

## Conclusion

The Predefined Routes System is a powerful tool for creating engaging tourist experiences. By following this guide and best practices, you can create high-quality routes that enhance visitor satisfaction and showcase the best of your destination.

Remember to regularly review and update your routes to ensure they remain accurate, relevant, and engaging for tourists.