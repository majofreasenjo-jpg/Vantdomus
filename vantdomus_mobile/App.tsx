import * as React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./src/config";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PickHouseholdScreen } from "./src/screens/PickHouseholdScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { FinanceScreen } from "./src/screens/FinanceScreen";
import { PersonsScreen } from "./src/screens/PersonsScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { TaxonomyProvider, useTaxonomy } from "./src/context/TaxonomyContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { tax } = useTaxonomy();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: "#1f2a3a" },
        headerTintColor: "#e9f0ff",
        tabBarStyle: { backgroundColor: "#1f2a3a", borderTopColor: "#334155" },
        tabBarActiveTintColor: "#5b7cfa",
        tabBarInactiveTintColor: "#64748b",
        tabBarIcon: ({ color, size }) => {
          let iconName: any = "help";
          if (route.name === "Dashboard") iconName = "grid-outline";
          else if (route.name === "Tasks") iconName = "checkmark-circle-outline";
          else if (route.name === "Persons") iconName = "people-outline";
          else if (route.name === "Finance") iconName = "wallet-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Resumen" }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: tax?.tasks || "Operaciones" }} />
      <Tab.Screen name="Persons" component={PersonsScreen} options={{ title: tax?.persons || "Cuadrilla" }} />
      <Tab.Screen name="Finance" component={FinanceScreen} options={{ title: tax?.finance || "Presupuesto" }} />
    </Tab.Navigator>
  );
}

function useBootstrap() {
  const [ready, setReady] = React.useState(false);
  const [hasToken, setHasToken] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(STORAGE_KEYS.token);
      setHasToken(!!t);
      setReady(true);
    })();
  }, []);
  return { ready, hasToken };
}


export default function App() {
  const { ready, hasToken } = useBootstrap();
  if (!ready) return null;

  return (
    <ErrorBoundary>
      <TaxonomyProvider>
        <NavigationContainer theme={DarkTheme}>
          <StatusBar style="light" />
          <Stack.Navigator initialRouteName={hasToken ? "Main" : "Auth"} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PickHousehold" component={PickHouseholdScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: true, title: "Asistente AI", headerStyle: { backgroundColor: "#1f2a3a" }, headerTintColor: "#e9f0ff" }} />
          </Stack.Navigator>
        </NavigationContainer>
      </TaxonomyProvider>
    </ErrorBoundary>
  );
}
