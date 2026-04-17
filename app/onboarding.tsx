import { useRouter } from "expo-router";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const onboardingData = [
  {
    id: "1",
    title: "Welcome To SafeSpend",
    image: require("../assets/images/coinhand.png"),
    circleColor: "#DFF7E2",
  },
  {
    id: "2",
    title: "Are You Ready To Take Control Of Your Finance?",
    image: require("../assets/images/bankhand.png"),
    circleColor: "#CDE6D8",
  },
];

export default function Onboarding() {
  const router = useRouter();
  return (
    <FlatList
      data={onboardingData}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={styles.page}>
          <View style={styles.topGreenBackground} />

          <SafeAreaView
            style={styles.safeArea}
            edges={["top", "left", "right"]}
          >
            <Text style={styles.title}>{item.title}</Text>
          </SafeAreaView>

          <View style={styles.card}>
            <View
              style={[
                styles.circleBackground,
                { backgroundColor: item.circleColor },
              ]}
            />

            <Image
              source={item.image}
              style={styles.image}
              resizeMode="contain"
            />
            <View style={styles.pagination}>
              {onboardingData.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === onboardingData.findIndex((d) => d.id === item.id) &&
                      styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {index === 1 && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => router.push("/landing")}
              >
                <Text style={styles.continueText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    width,
    height,
    backgroundColor: "#F1FFF3",
    alignItems: "center",
  },
  topGreenBackground: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 400, // Extends just far enough down to hide behind the curved card
    backgroundColor: "#00D09E",
  },
  safeArea: {
    alignItems: "center",
    paddingVertical: 40,
  },

  title: {
    top: 40,
    fontSize: 30,
    width: 230,
    textAlign: "center",
    fontWeight: "bold",
    color: "#0E3E3E",
    fontFamily: "Poppins_700Bold",
    lineHeight: 39,
  },

  card: {
    height: 550,
    width: "100%",
    backgroundColor: "#F1FFF3",
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 300,
  },

  circleBackground: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 120,
    zIndex: 0,
    alignSelf: "center",
  },

  image: {
    width: 287,
    height: 287,
    position: "absolute",
    top: 120,
    zIndex: 1,
    alignSelf: "center",
  },

  pagination: {
    position: "absolute",
    bottom: 50,
    flexDirection: "row",
    alignSelf: "center",
    zIndex: 2,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CDE6D8",
    marginHorizontal: 6,
  },

  activeDot: {
    backgroundColor: "#00D09E",
    width: 18,
  },

  continueButton: {
    backgroundColor: "#00D09E",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    marginTop: 350,
  },

  continueText: {
    color: "#0E3E3E",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Poppins_700Bold",
  },
});
