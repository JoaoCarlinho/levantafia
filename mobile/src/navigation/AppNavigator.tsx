import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GalleryScreen } from '../screens/GalleryScreen';
import { UploadScreen } from '../screens/UploadScreen';

export type RootTabParamList = {
  Gallery: undefined;
  Upload: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Gallery"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#333333',
          },
          tabBarActiveTintColor: '#60a5fa',
          tabBarInactiveTintColor: '#888888',
        }}
      >
        <Tab.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{
            title: 'Photos',
            tabBarLabel: 'Gallery',
          }}
        />
        <Tab.Screen
          name="Upload"
          component={UploadScreen}
          options={{
            title: 'Upload',
            tabBarLabel: 'Upload',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
